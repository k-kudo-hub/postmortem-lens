import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { buildSystemPrompt, buildUserContent } from "./prompt";
import { type Analysis, analysisSchema, type Finding } from "./schema";
import { type VerifiedAnalysis, verifyAnalysis } from "./verify";
import { VIEWPOINTS } from "./viewpoints";

export const MODEL = "claude-opus-5-5";

/** 利用者に見せる言葉で止まった理由を持つエラー */
export class AnalysisError extends Error {
	override name = "AnalysisError";
}

/**
 * 利用者の API キーで、ブラウザから直接 Claude API を呼ぶクライアントを作る。
 * キーはこのページの外（Anthropic の API 以外）には送らない。
 */
export function createClient(apiKey: string): Anthropic {
	return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

type AnalyzeOptions = {
	report: string;
	client: Anthropic;
	/** 出力の途中経過（受け取った文字数） */
	onProgress?: (receivedChars: number) => void;
};

/** 全観点を一覧の順に並べ、返ってこなかった観点を「記述なし」で埋める */
function completeFindings(analysis: Analysis): Analysis {
	const byId = new Map<string, Finding>();
	for (const finding of analysis.findings) {
		if (!byId.has(finding.viewpoint)) {
			byId.set(finding.viewpoint, finding);
		}
	}
	return {
		...analysis,
		findings: VIEWPOINTS.map(
			(v) =>
				byId.get(v.id) ?? {
					viewpoint: v.id,
					mentioned: false,
					quotes: [],
					reading: "",
					question: "",
					actions: [],
				},
		),
	};
}

export async function analyzeReport({
	report,
	client,
	onProgress,
}: AnalyzeOptions): Promise<VerifiedAnalysis> {
	if (report.trim() === "") {
		throw new AnalysisError("障害報告の本文を貼ってください。");
	}

	const stream = client.beta.messages.stream({
		model: MODEL,
		max_tokens: 64000,
		// Claude が安全上の理由で断ったとき、API 側で別のモデルに切り替えて続ける
		betas: ["server-side-fallback-2026-07-01"],
		fallbacks: "default",
		output_config: {
			effort: "high",
			// parse を持たない形で渡す。SDK に自動で読み取らせると、出力が途中で切れたときに
			// stop_reason を確かめる前に読み取りの失敗で止まり、利用者に理由を伝えられないため
			format: { type: "json_schema", schema: OUTPUT_SCHEMA },
		},
		system: buildSystemPrompt(),
		messages: [{ role: "user", content: buildUserContent(report) }],
	});
	stream.on("text", (_delta, snapshot) => onProgress?.(snapshot.length));

	const message = await stream.finalMessage();
	if (message.stop_reason === "refusal") {
		throw new AnalysisError(
			"この本文の分解は Claude に断られました。本文に障害報告以外の内容が含まれていないか確かめてください。",
		);
	}
	if (
		message.stop_reason === "max_tokens" ||
		message.stop_reason === "model_context_window_exceeded"
	) {
		throw new AnalysisError(
			"出力が途中で切れました。本文を障害の報告部分だけに絞って、もう一度試してください。",
		);
	}
	const text = message.content
		.map((block) => (block.type === "text" ? block.text : ""))
		.join("");
	const parsed = parseAnalysis(text);
	if (!parsed) {
		throw new AnalysisError(
			"Claude の出力を読み取れませんでした。もう一度試してください。",
		);
	}
	return verifyAnalysis(completeFindings(parsed), report);
}

const OUTPUT_SCHEMA = betaZodOutputFormat(analysisSchema).schema;

function parseAnalysis(text: string): Analysis | null {
	try {
		const result = analysisSchema.safeParse(JSON.parse(text));
		return result.success ? result.data : null;
	} catch {
		return null;
	}
}

/** API のエラーを、利用者が次に何をすればよいか分かる言葉にする */
export function toUserMessage(error: unknown): string {
	if (error instanceof AnalysisError) {
		return error.message;
	}
	if (error instanceof Anthropic.AuthenticationError) {
		return "API キーが正しくないか、無効になっています。Claude Console でキーを確かめてください。";
	}
	if (error instanceof Anthropic.PermissionDeniedError) {
		return "この API キーでは、このモデルを使う権限がありません。";
	}
	if (error instanceof Anthropic.RateLimitError) {
		return "API の利用上限に達しました。しばらく待ってから、もう一度試してください。";
	}
	if (error instanceof Anthropic.BadRequestError) {
		return `リクエストが受け付けられませんでした（${error.message}）。クレジットの残高が足りないときもこのエラーになります。`;
	}
	if (error instanceof Anthropic.APIConnectionError) {
		return "Claude API に接続できませんでした。ネットワークを確かめてください。";
	}
	if (error instanceof Anthropic.APIError) {
		return `Claude API でエラーが起きました（${error.message}）。しばらく待ってから、もう一度試してください。`;
	}
	return "予期しないエラーが起きました。もう一度試してください。";
}
