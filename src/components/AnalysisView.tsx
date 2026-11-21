import { useId, useMemo, useState } from "react";
import { type Mark, type Marks, toMarkdown } from "../lens/markdown";
import type { VerifiedAnalysis } from "../lens/verify";
import { SECTIONS, viewpointsOf } from "../lens/viewpoints";
import { FindingCard } from "./FindingCard";

type Props = {
	analysis: VerifiedAnalysis;
	isSample: boolean;
	marks: Marks;
	onMark: (viewpoint: string, mark: Mark) => void;
};

export function AnalysisView({ analysis, isSample, marks, onMark }: Props) {
	const markdownId = useId();
	const [copied, setCopied] = useState(false);
	const markdown = useMemo(
		() => toMarkdown(analysis, marks),
		[analysis, marks],
	);
	const findingOf = (id: string) =>
		analysis.findings.find((f) => f.viewpoint === id);
	const dropped = analysis.findings.reduce((n, f) => n + f.droppedQuotes, 0);
	const missing = analysis.findings.filter((f) => !f.mentioned);

	async function copy() {
		try {
			await navigator.clipboard.writeText(markdown);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			setCopied(false);
		}
	}

	function download() {
		const url = URL.createObjectURL(
			new Blob([markdown], { type: "text/markdown" }),
		);
		const a = document.createElement("a");
		a.href = url;
		a.download = "postmortem-lens.md";
		a.click();
		URL.revokeObjectURL(url);
	}

	return (
		<section className="analysis" aria-labelledby="analysis-heading">
			{isSample && (
				<p className="sample-note">
					これは架空の障害報告を分解した見本です。実在の会社・障害ではありません。
				</p>
			)}
			<h2 id="analysis-heading">{analysis.incident}</h2>
			<p className="summary">{analysis.summary}</p>
			<p className="hint">
				観点ごとに「当てはまる」「まだ分からない」「当てはまらない」を選ぶと、下の会議用の
				Markdown に反映されます。
				{dropped > 0 &&
					` 本文にそのまま見つからなかった引用 ${dropped} 件は表示していません。`}
			</p>

			{SECTIONS.map((section) => {
				const viewpoints = viewpointsOf(section.id).filter(
					(v) => findingOf(v.id)?.mentioned,
				);
				return (
					<section key={section.id} className="section">
						<h3>
							{section.label}
							<span className="count">
								{viewpoints.length} / {viewpointsOf(section.id).length} 観点
							</span>
						</h3>
						<p className="section-description">{section.description}</p>
						{viewpoints.length === 0 && (
							<p className="empty">
								この項目に当たる記述は、本文にありませんでした。
							</p>
						)}
						{viewpoints.map((v) => {
							const finding = findingOf(v.id);
							return (
								finding && (
									<FindingCard
										key={v.id}
										viewpoint={v}
										finding={finding}
										mark={marks[v.id]}
										onMark={(mark) => onMark(v.id, mark)}
									/>
								)
							);
						})}
					</section>
				);
			})}

			{missing.length > 0 && (
				<details className="missing">
					<summary>この報告に記述がなかった観点（{missing.length}）</summary>
					<p className="hint">
						報告には書かれていなくても、自社では確かめておきたい観点です。
					</p>
					<ul>
						{SECTIONS.flatMap((section) =>
							viewpointsOf(section.id)
								.filter((v) => !findingOf(v.id)?.mentioned)
								.map((v) => (
									<li key={v.id}>
										<span className="missing-section">{section.label}</span>
										<strong>{v.title}</strong>
										<p>{v.question}</p>
									</li>
								)),
						)}
					</ul>
				</details>
			)}

			<section className="export" aria-labelledby="export-heading">
				<h3 id="export-heading">会議に持ち込む</h3>
				<label htmlFor={markdownId}>会議用の Markdown</label>
				<textarea id={markdownId} readOnly value={markdown} rows={14} />
				<div className="actions">
					<button type="button" onClick={copy}>
						{copied ? "コピーしました" : "コピーする"}
					</button>
					<button type="button" className="secondary" onClick={download}>
						.md で保存する
					</button>
				</div>
			</section>
		</section>
	);
}
