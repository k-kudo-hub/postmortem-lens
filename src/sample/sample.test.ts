import { describe, expect, it } from "vitest";
import { analysisSchema } from "../lens/schema";
import { verifyAnalysis } from "../lens/verify";
import { VIEWPOINTS } from "../lens/viewpoints";
import { SAMPLE_ANALYSIS } from "./analysis";
import { SAMPLE_REPORT } from "./report";

describe("見本", () => {
	it("出力のスキーマに合っている", () => {
		expect(analysisSchema.safeParse(SAMPLE_ANALYSIS).success).toBe(true);
	});

	it("全観点を一覧の順に持つ", () => {
		expect(SAMPLE_ANALYSIS.findings.map((f) => f.viewpoint)).toEqual(
			VIEWPOINTS.map((v) => v.id),
		);
	});

	it("引用はすべて見本の本文にそのまま見つかる", () => {
		const verified = verifyAnalysis(SAMPLE_ANALYSIS, SAMPLE_REPORT);
		for (const finding of verified.findings) {
			expect(finding.droppedQuotes, finding.viewpoint).toBe(0);
		}
		expect(verified.findings.filter((f) => f.mentioned).length).toBe(
			SAMPLE_ANALYSIS.findings.filter((f) => f.mentioned).length,
		);
	});

	it("架空であることを本文と名前に書いている", () => {
		expect(SAMPLE_REPORT).toContain("架空");
		expect(SAMPLE_ANALYSIS.incident).toContain("架空");
	});
});
