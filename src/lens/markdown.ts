import type { VerifiedAnalysis, VerifiedFinding } from "./verify";
import { findViewpoint, SECTIONS } from "./viewpoints";

/** 読み手が観点ごとに付ける印 */
export type Mark = "applies" | "unknown" | "not";
export type Marks = Partial<Record<string, Mark>>;

const GROUPS: { heading: string; pick: (mark: Mark | undefined) => boolean }[] =
	[
		{ heading: "当てはまる", pick: (m) => m === "applies" },
		{ heading: "確かめる（まだ分からない）", pick: (m) => m === "unknown" },
		{ heading: "未判定", pick: (m) => m === undefined },
	];

function sectionLabel(sectionId: string): string {
	return SECTIONS.find((s) => s.id === sectionId)?.label ?? sectionId;
}

function findingToMarkdown(finding: VerifiedFinding): string {
	const viewpoint = findViewpoint(finding.viewpoint);
	if (!viewpoint) {
		return "";
	}
	const lines = [
		`### ${sectionLabel(viewpoint.section)}: ${viewpoint.title}`,
		"",
	];
	for (const quote of finding.quotes) {
		lines.push(`> ${quote.replace(/\s+/g, " ").trim()}`, "");
	}
	if (finding.reading) {
		lines.push(finding.reading, "");
	}
	lines.push(`**自社への問い**: ${finding.question || viewpoint.question}`, "");
	if (finding.actions.length > 0) {
		lines.push("**今とれる対策**", "");
		for (const a of finding.actions) {
			lines.push(`- [ ] ${a.action}（最初の一歩: ${a.first_step}）`);
		}
		lines.push("");
	}
	return lines.join("\n");
}

/**
 * 会議に持ち込むための Markdown を作る。
 * 当てはまらないと判断した観点と、報告に記述のない観点は書かない。
 */
export function toMarkdown(analysis: VerifiedAnalysis, marks: Marks): string {
	const mentioned = analysis.findings.filter((f) => f.mentioned);
	const parts = [`# ${analysis.incident}`, "", analysis.summary, ""];
	for (const group of GROUPS) {
		const findings = mentioned.filter((f) => group.pick(marks[f.viewpoint]));
		if (findings.length === 0) {
			continue;
		}
		parts.push(`## ${group.heading}`, "");
		for (const finding of findings) {
			parts.push(findingToMarkdown(finding));
		}
	}
	return `${parts.join("\n").trimEnd()}\n`;
}
