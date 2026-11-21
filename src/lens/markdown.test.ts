import { describe, expect, it } from "vitest";
import { toMarkdown } from "./markdown";
import type { VerifiedAnalysis } from "./verify";

const analysis: VerifiedAnalysis = {
	incident: "Example 障害（2026-11-12）",
	summary: "入口のサーバーが応答しなくなった。",
	findings: [
		{
			viewpoint: "trigger.normal-operation",
			mentioned: true,
			quotes: ["Teams failed over to the primary gateway."],
			reading: "フェイルオーバーで負荷が増えた。",
			question:
				"自社のフェイルオーバー先は、移ってくる負荷を受け止められるか。",
			actions: [
				{ action: "移り先の容量を測る", first_step: "直近の切替の記録を見る" },
			],
			droppedQuotes: 0,
		},
		{
			viewpoint: "cascade.redistribution",
			mentioned: true,
			quotes: ["traffic was redirected"],
			reading: "振り分けが連鎖を広げた。",
			question: "振り分けが負荷を寄せないか。",
			actions: [],
			droppedQuotes: 0,
		},
		{
			viewpoint: "containment.bulkhead",
			mentioned: true,
			quotes: ["bulkheads did not stop"],
			reading: "隔壁が効かなかった。",
			question: "隔壁を試したか。",
			actions: [],
			droppedQuotes: 0,
		},
		{
			viewpoint: "recovery.rollback",
			mentioned: false,
			quotes: [],
			reading: "",
			question: "",
			actions: [],
			droppedQuotes: 0,
		},
	],
};

describe("toMarkdown", () => {
	const md = toMarkdown(analysis, {
		"trigger.normal-operation": "applies",
		"cascade.redistribution": "unknown",
		"containment.bulkhead": "not",
	});

	it("障害の名前と要約を見出しに置く", () => {
		expect(md).toContain("# Example 障害（2026-11-12）");
		expect(md).toContain("入口のサーバーが応答しなくなった。");
	});

	it("当てはまる観点を、引用・問い・今とれる対策つきで書く", () => {
		expect(md).toContain("## 当てはまる");
		expect(md).toContain("### きっかけ: 設計どおりの動きが負荷を変える");
		expect(md).toContain("> Teams failed over to the primary gateway.");
		expect(md).toContain(
			"自社のフェイルオーバー先は、移ってくる負荷を受け止められるか。",
		);
		expect(md).toContain(
			"- [ ] 移り先の容量を測る（最初の一歩: 直近の切替の記録を見る）",
		);
	});

	it("まだ分からない観点を、確かめる項目として分けて書く", () => {
		const unknownPart = md.split("## 確かめる")[1];
		expect(unknownPart).toContain("連鎖: 振り分けが負荷を寄せる");
	});

	it("当てはまらない観点と、報告に記述のない観点は書かない", () => {
		expect(md).not.toContain("隔壁が効くか");
		expect(md).not.toContain("巻き戻せない変更");
	});

	it("印のない記述ありの観点は、未判定としてまとめる", () => {
		const md2 = toMarkdown(analysis, {});
		expect(md2).toContain("## 未判定");
		expect(md2).toContain("隔壁が効くか");
	});
});
