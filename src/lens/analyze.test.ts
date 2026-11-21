import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { AnalysisError, analyzeReport, toUserMessage } from "./analyze";
import type { Analysis } from "./schema";
import { VIEWPOINTS } from "./viewpoints";

const report =
	"Approximately fifteen hours before the outage, Teams failed over from the alternative networking gateway.";

function fakeClient(message: Record<string, unknown>) {
	const calls: Record<string, unknown>[] = [];
	const client = {
		beta: {
			messages: {
				stream: vi.fn((params: Record<string, unknown>) => {
					calls.push(params);
					const handlers: ((delta: string, snapshot: string) => void)[] = [];
					const stream = {
						on(
							event: string,
							handler: (delta: string, snapshot: string) => void,
						) {
							if (event === "text") handlers.push(handler);
							return stream;
						},
						async finalMessage() {
							for (const h of handlers) h("{", '{"incident"');
							return message;
						},
					};
					return stream;
				}),
			},
		},
	};
	return { client: client as unknown as Anthropic, calls };
}

const parsed: Analysis = {
	incident: "テスト障害",
	summary: "要約",
	findings: [
		{
			viewpoint: "trigger.normal-operation",
			mentioned: true,
			quotes: ["Teams failed over from the alternative networking gateway"],
			reading: "Teams のフェイルオーバーが負荷を増やした",
			question: "自社のフェイルオーバー先は負荷を受け止められるか",
			actions: [{ action: "対策", first_step: "最初の一歩" }],
		},
		{
			viewpoint: "trigger.latent-change",
			mentioned: true,
			quotes: ["この文は本文にない"],
			reading: "",
			question: "",
			actions: [],
		},
	],
};

describe("analyzeReport", () => {
	it("報告の本文を Claude に渡し、観点の一覧と出力スキーマを指定する", async () => {
		const { client, calls } = fakeClient({
			stop_reason: "end_turn",
			parsed_output: parsed,
		});
		await analyzeReport({ report, client });
		const params = calls[0];
		expect(params.model).toBe("claude-opus-5-5");
		expect(JSON.stringify(params.messages)).toContain(report);
		expect(String(params.system)).toContain("trigger.normal-operation");
		expect(params.output_config).toMatchObject({
			format: { type: "json_schema" },
		});
	});

	it("全観点を一覧の順に並べ、返ってこなかった観点は記述なしで埋める", async () => {
		const { client } = fakeClient({
			stop_reason: "end_turn",
			parsed_output: parsed,
		});
		const result = await analyzeReport({ report, client });
		expect(result.findings.map((f) => f.viewpoint)).toEqual(
			VIEWPOINTS.map((v) => v.id),
		);
		const missing = result.findings.find(
			(f) => f.viewpoint === "cascade.redistribution",
		);
		expect(missing).toMatchObject({
			mentioned: false,
			quotes: [],
			actions: [],
		});
	});

	it("本文にない引用を外す", async () => {
		const { client } = fakeClient({
			stop_reason: "end_turn",
			parsed_output: parsed,
		});
		const result = await analyzeReport({ report, client });
		const latent = result.findings.find(
			(f) => f.viewpoint === "trigger.latent-change",
		);
		expect(latent).toMatchObject({
			mentioned: false,
			quotes: [],
			droppedQuotes: 1,
		});
	});

	it("出力の途中経過を知らせる", async () => {
		const { client } = fakeClient({
			stop_reason: "end_turn",
			parsed_output: parsed,
		});
		const onProgress = vi.fn();
		await analyzeReport({ report, client, onProgress });
		expect(onProgress).toHaveBeenCalledWith(11);
	});

	it("本文が空なら API を呼ばずに止める", async () => {
		const { client } = fakeClient({
			stop_reason: "end_turn",
			parsed_output: parsed,
		});
		await expect(
			analyzeReport({ report: "  \n ", client }),
		).rejects.toBeInstanceOf(AnalysisError);
		expect(client.beta.messages.stream).not.toHaveBeenCalled();
	});

	it("Claude が断ったとき・出力が途中で切れたときは、分かる言葉で止める", async () => {
		const refused = fakeClient({ stop_reason: "refusal", parsed_output: null });
		await expect(
			analyzeReport({ report, client: refused.client }),
		).rejects.toThrow(/断られました/);
		const cut = fakeClient({ stop_reason: "max_tokens", parsed_output: null });
		await expect(analyzeReport({ report, client: cut.client })).rejects.toThrow(
			/途中で切れ/,
		);
	});
});

describe("toUserMessage", () => {
	it("API キーの誤りを、キーを見直すよう伝える言葉にする", () => {
		const error = new Anthropic.AuthenticationError(
			401,
			undefined,
			"invalid x-api-key",
			new Headers(),
		);
		expect(toUserMessage(error)).toMatch(/API キー/);
	});

	it("利用上限を、時間をおくよう伝える言葉にする", () => {
		const error = new Anthropic.RateLimitError(
			429,
			undefined,
			"rate limited",
			new Headers(),
		);
		expect(toUserMessage(error)).toMatch(/上限/);
	});
});
