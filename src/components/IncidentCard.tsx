import { useId } from "react";
import { findViewpoint, SECTIONS } from "../lens/viewpoints";
import type { Incident } from "../stock/schema";

function viewpointLabel(id: string): string {
	const viewpoint = findViewpoint(id);
	if (!viewpoint) {
		return id;
	}
	const section = SECTIONS.find((s) => s.id === viewpoint.section);
	return `${section?.label ?? viewpoint.section}・${viewpoint.title}`;
}

export function IncidentCard({ incident }: { incident: Incident }) {
	const titleId = useId();

	return (
		<article className="incident" aria-labelledby={titleId}>
			<p className="meta">
				{incident.startedAt}・{incident.provider}・{incident.duration}
			</p>
			<h3 id={titleId}>{incident.title}</h3>
			<p className="service">{incident.service}</p>
			<p>{incident.summary}</p>
			<p className="source">
				<a href={incident.source.url} target="_blank" rel="noreferrer">
					出典: {incident.source.title}
				</a>
				{incident.source.note && (
					<span className="note">（{incident.source.note}）</span>
				)}
			</p>

			<details>
				<summary>弱い箇所（{incident.weaknesses.length}）</summary>
				{incident.weaknesses.map((w) => (
					<section key={w.id} className="weakness">
						<p className="viewpoint">{viewpointLabel(w.viewpoint)}</p>
						<h4>{w.title}</h4>
						<p>{w.whatHappened}</p>
						{w.quotes.map((q) => (
							<blockquote key={q}>{q}</blockquote>
						))}
						<span className="label">リポジトリで探すもの</span>
						<ul>
							{w.lookFor.map((l) => (
								<li key={l}>{l}</li>
							))}
						</ul>
						<span className="label">今とれる対策</span>
						<ul>
							{w.countermeasures.map((c) => (
								<li key={c.action}>
									<p>{c.action}</p>
									<p className="first-step">最初の一歩: {c.firstStep}</p>
								</li>
							))}
						</ul>
					</section>
				))}
			</details>
		</article>
	);
}
