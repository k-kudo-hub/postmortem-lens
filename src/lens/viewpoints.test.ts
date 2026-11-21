import { describe, expect, it } from "vitest";
import { SECTIONS, VIEWPOINTS, viewpointsOf } from "./viewpoints";

describe("観点の一覧", () => {
	it("5つの固定項目を、きっかけ→連鎖→封じ込め→復旧→再発防止の順に持つ", () => {
		expect(SECTIONS.map((s) => s.id)).toEqual([
			"trigger",
			"cascade",
			"containment",
			"recovery",
			"prevention",
		]);
		expect(SECTIONS.map((s) => s.label)).toEqual([
			"きっかけ",
			"連鎖",
			"封じ込めの失敗",
			"復旧が遅れた理由",
			"再発防止",
		]);
	});

	it("どの項目にも観点が1つ以上あり、観点の id は重ならない", () => {
		for (const section of SECTIONS) {
			expect(viewpointsOf(section.id).length).toBeGreaterThan(0);
		}
		const ids = VIEWPOINTS.map((v) => v.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("観点にはどれも、自社に当てはめる問いが付いている", () => {
		for (const v of VIEWPOINTS) {
			expect(v.title).not.toBe("");
			expect(v.question).toMatch(/か。?$/);
		}
	});
});
