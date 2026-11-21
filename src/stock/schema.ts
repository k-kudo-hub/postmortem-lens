import { z } from "zod/v4";
import { VIEWPOINT_IDS } from "../lens/viewpoints";

// 公開ページの CSP は eval を許さないため、Zod が起動時に new Function を試さないようにする
z.config({ jitless: true });

/** 今とれる対策 */
export const countermeasureSchema = z.object({
	/** 何をするか */
	action: z.string().min(1),
	/** 今日から始められる最初の一歩（何を確かめるか） */
	firstStep: z.string().min(1),
});

/** 障害を起こした弱い箇所。利用者のリポジトリに同じものがないかを探す単位 */
export const weaknessSchema = z.object({
	/** 障害の中で一意な id（小文字とハイフン） */
	id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
	/** 観点の一覧（src/lens/viewpoints.ts）の id */
	viewpoint: z.enum(VIEWPOINT_IDS),
	/** 弱い箇所の短い名前 */
	title: z.string().min(1),
	/** この障害で、この弱い箇所が何を起こしたか */
	whatHappened: z.string().min(1),
	/** 根拠になる一次情報の本文の抜き出し（本文の文字列をそのまま写す） */
	quotes: z.array(z.string().min(1)).min(1),
	/** 利用者のリポジトリで、同じ弱い箇所を見つけるために探すもの */
	lookFor: z.array(z.string().min(1)).min(1),
	/** 今とれる対策 */
	countermeasures: z.array(countermeasureSchema).min(1),
});

export const incidentSchema = z.object({
	/** 発生日と内容を表す id。ファイル名と同じにする */
	id: z.string().regex(/^\d{4}-\d{2}-\d{2}-[a-z0-9]+(-[a-z0-9]+)*$/),
	/** 障害の名前 */
	title: z.string().min(1),
	/** 報告を出した事業者 */
	provider: z.string().min(1),
	/** 止まったサービス */
	service: z.string().min(1),
	/** 発生日（YYYY-MM-DD、UTC） */
	startedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
	/** 影響が続いた時間 */
	duration: z.string().min(1),
	/** 一次情報 */
	source: z.object({
		title: z.string().min(1),
		url: z.url(),
		publisher: z.string().min(1),
		/** 一次情報の出どころの補足（転載を読んだ場合など） */
		note: z.string().optional(),
	}),
	/** 障害の要約（3文以内） */
	summary: z.string().min(1),
	weaknesses: z.array(weaknessSchema).min(1),
});

export type Countermeasure = z.infer<typeof countermeasureSchema>;
export type Weakness = z.infer<typeof weaknessSchema>;
export type Incident = z.infer<typeof incidentSchema>;
