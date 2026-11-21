import { useId } from "react";
import type { Mark } from "../lens/markdown";
import type { VerifiedFinding } from "../lens/verify";
import type { Viewpoint } from "../lens/viewpoints";

const MARK_OPTIONS: { value: Mark; label: string }[] = [
	{ value: "applies", label: "当てはまる" },
	{ value: "unknown", label: "まだ分からない" },
	{ value: "not", label: "当てはまらない" },
];

type Props = {
	viewpoint: Viewpoint;
	finding: VerifiedFinding;
	mark: Mark | undefined;
	onMark: (mark: Mark) => void;
};

export function FindingCard({ viewpoint, finding, mark, onMark }: Props) {
	const titleId = useId();
	const name = useId();

	return (
		<article
			className={`finding mark-${mark ?? "none"}`}
			aria-labelledby={titleId}
		>
			<h4 id={titleId}>{viewpoint.title}</h4>
			<p className="why">{viewpoint.why}</p>

			<div className="quotes">
				{finding.quotes.map((quote, i) => (
					<blockquote key={`${i}-${quote}`}>{quote}</blockquote>
				))}
			</div>
			{finding.reading && <p className="reading">{finding.reading}</p>}

			<div className="question">
				<span className="label">自社への問い</span>
				<p>{finding.question || viewpoint.question}</p>
				<fieldset className="marks">
					<legend className="visually-hidden">
						{viewpoint.title}は自社に当てはまるか
					</legend>
					{MARK_OPTIONS.map((option) => (
						<label key={option.value} className="mark-option">
							<input
								type="radio"
								name={name}
								value={option.value}
								checked={mark === option.value}
								onChange={() => onMark(option.value)}
							/>
							{option.label}
						</label>
					))}
				</fieldset>
			</div>

			{finding.actions.length > 0 && (
				<div className="actions-list">
					<span className="label">今とれる対策</span>
					<ul>
						{finding.actions.map((a, i) => (
							<li key={`${i}-${a.action}`}>
								<p>{a.action}</p>
								<p className="first-step">最初の一歩: {a.first_step}</p>
							</li>
						))}
					</ul>
				</div>
			)}
		</article>
	);
}
