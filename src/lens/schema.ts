import { z } from "zod/v4";
import { VIEWPOINT_IDS } from "./viewpoints";

// 本番のページの CSP は eval を許さないため、Zod が起動時に new Function を試さないようにする
z.config({ jitless: true });

/** 今とれる対策 */
export const actionSchema = z.object({
	action: z.string().describe("自社で今とれる対策。何をするかを一文で"),
	first_step: z
		.string()
		.describe("その対策に向けて、今日から始められる最初の一歩（確かめ方）"),
});

/** 1つの観点について、報告から読み取ったこと */
export const findingSchema = z.object({
	viewpoint: z.enum(VIEWPOINT_IDS).describe("観点の id"),
	mentioned: z.boolean().describe("この観点に当たる記述が報告の本文にあるか"),
	quotes: z
		.array(z.string())
		.describe(
			"根拠になる本文の抜き出し。本文の文字列をそのまま写す（要約・翻訳しない）",
		),
	reading: z
		.string()
		.describe("この報告でこの観点に何が起きたか。引用に書かれていることだけ"),
	question: z
		.string()
		.describe("この報告を踏まえて、読み手が自社の設計に当てはめる具体的な問い"),
	actions: z.array(actionSchema).describe("今とれる対策（1〜3個）"),
});

export const analysisSchema = z.object({
	incident: z.string().describe("障害の短い名前（サービス名と日付）"),
	summary: z.string().describe("障害の要約（3文以内）"),
	findings: z.array(findingSchema),
});

export type Action = z.infer<typeof actionSchema>;
export type Finding = z.infer<typeof findingSchema>;
export type Analysis = z.infer<typeof analysisSchema>;
