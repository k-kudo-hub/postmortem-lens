import type { Analysis, Finding } from "./schema";

/** 根拠として認める引用の最短の長さ（正規化した後の文字数） */
const MIN_QUOTE_LENGTH = 8;

/**
 * 引用と本文を比べられる形にそろえる。
 * PDF やメールから写した本文は改行の位置・全角半角・引用符の形が揺れるため、それだけを無視する。
 */
export function normalize(text: string): string {
	return text
		.normalize("NFKC")
		.replace(/[‘’‚‛′]/g, "'")
		.replace(/[“”„‟″]/g, '"')
		.replace(/\s+/g, " ")
		.trim();
}

export function isQuoteInSource(quote: string, source: string): boolean {
	const q = normalize(quote);
	if (q.length < MIN_QUOTE_LENGTH) {
		return false;
	}
	return normalize(source).includes(q);
}

export type VerifiedFinding = Finding & {
	/** 本文に見つからず外した引用の数 */
	droppedQuotes: number;
};

export type VerifiedAnalysis = Omit<Analysis, "findings"> & {
	findings: VerifiedFinding[];
};

/**
 * AI が返した引用のうち、本文にそのまま見つかるものだけを残す。
 * 同じ引用・同じ対策が重なって返ったときは1つにまとめる。
 * 引用がすべて外れた観点は、根拠がないので「記述なし」として扱う。
 */
export function verifyAnalysis(
	analysis: Analysis,
	source: string,
): VerifiedAnalysis {
	const normalizedSource = normalize(source);
	return {
		...analysis,
		findings: analysis.findings.map((finding) => {
			const unique = [...new Set(finding.quotes)];
			const kept = unique.filter((quote) => {
				const q = normalize(quote);
				return q.length >= MIN_QUOTE_LENGTH && normalizedSource.includes(q);
			});
			const actions = finding.actions.filter(
				(a, i, all) => all.findIndex((b) => b.action === a.action) === i,
			);
			return {
				...finding,
				quotes: kept,
				actions,
				mentioned: finding.mentioned && kept.length > 0,
				droppedQuotes: unique.length - kept.length,
			};
		}),
	};
}
