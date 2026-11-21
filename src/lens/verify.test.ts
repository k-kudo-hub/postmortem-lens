import { describe, expect, it } from "vitest";
import type { Analysis } from "./schema";
import { isQuoteInSource, verifyAnalysis } from "./verify";

const source = `Root Cause
The incident was caused by three main factors.
First, a latent defect caused Windows servers to become
overwhelmed and unresponsive under certain load conditions.
Teams failed over from the alternative networking gateway to the ‘primary’ gateway.`;

describe("isQuoteInSource", () => {
	it("本文にそのままある文字列を見つける", () => {
		expect(
			isQuoteInSource("The incident was caused by three main factors.", source),
		).toBe(true);
	});

	it("改行と空白の違いは無視する（PDF から写した本文の改行位置が違っても見つける）", () => {
		expect(
			isQuoteInSource(
				"a latent defect caused Windows servers to become overwhelmed and unresponsive",
				source,
			),
		).toBe(true);
	});

	it("引用符の形の違い（‘’ と ''）は無視する", () => {
		expect(isQuoteInSource("to the 'primary' gateway", source)).toBe(true);
	});

	it("言い換え・要約された文字列は見つからない", () => {
		expect(
			isQuoteInSource("A latent bug made the servers unresponsive.", source),
		).toBe(false);
	});

	it("空の文字列と短すぎる文字列は根拠として認めない", () => {
		expect(isQuoteInSource("", source)).toBe(false);
		expect(isQuoteInSource("the", source)).toBe(false);
	});
});

describe("verifyAnalysis", () => {
	const analysis: Analysis = {
		incident: "テスト",
		summary: "要約",
		findings: [
			{
				viewpoint: "trigger.latent-change",
				mentioned: true,
				quotes: [
					"a latent defect caused Windows servers to become overwhelmed",
					"This sentence does not exist in the report.",
				],
				reading: "読み解き",
				question: "問い",
				actions: [],
			},
		],
	};

	it("本文にない引用を外し、外した数を残す", () => {
		const result = verifyAnalysis(analysis, source);
		const finding = result.findings[0];
		expect(finding.quotes).toEqual([
			"a latent defect caused Windows servers to become overwhelmed",
		]);
		expect(finding.droppedQuotes).toBe(1);
	});

	it("同じ引用・同じ対策が重なって返ったときは、1つにまとめる", () => {
		const quote =
			"a latent defect caused Windows servers to become overwhelmed";
		const action = { action: "対策", first_step: "一歩" };
		const result = verifyAnalysis(
			{
				...analysis,
				findings: [
					{
						...analysis.findings[0],
						quotes: [quote, quote],
						actions: [action, action],
					},
				],
			},
			source,
		);
		expect(result.findings[0].quotes).toEqual([quote]);
		expect(result.findings[0].actions).toEqual([action]);
		expect(result.findings[0].droppedQuotes).toBe(0);
	});

	it("引用がすべて外れた観点は、記述なしとして扱う", () => {
		const result = verifyAnalysis(
			{
				...analysis,
				findings: [
					{
						...analysis.findings[0],
						quotes: ["This sentence does not exist in the report."],
					},
				],
			},
			source,
		);
		expect(result.findings[0].mentioned).toBe(false);
		expect(result.findings[0].droppedQuotes).toBe(1);
	});
});
