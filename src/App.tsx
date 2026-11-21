import { useState } from "react";
import { AnalysisView } from "./components/AnalysisView";
import { ReportForm } from "./components/ReportForm";
import { analyzeReport, createClient, toUserMessage } from "./lens/analyze";
import type { Marks } from "./lens/markdown";
import { type VerifiedAnalysis, verifyAnalysis } from "./lens/verify";
import { SAMPLE_ANALYSIS } from "./sample/analysis";
import { SAMPLE_REPORT } from "./sample/report";

type Status =
	| { kind: "idle" }
	| { kind: "running"; receivedChars: number }
	| { kind: "error"; message: string };

export default function App() {
	const [status, setStatus] = useState<Status>({ kind: "idle" });
	const [analysis, setAnalysis] = useState<VerifiedAnalysis | null>(null);
	const [isSample, setIsSample] = useState(false);
	const [marks, setMarks] = useState<Marks>({});

	function show(result: VerifiedAnalysis, sample: boolean) {
		setAnalysis(result);
		setIsSample(sample);
		setMarks({});
	}

	async function handleAnalyze(report: string, apiKey: string) {
		setStatus({ kind: "running", receivedChars: 0 });
		try {
			const result = await analyzeReport({
				report,
				client: createClient(apiKey),
				onProgress: (receivedChars) =>
					setStatus({ kind: "running", receivedChars }),
			});
			show(result, false);
			setStatus({ kind: "idle" });
		} catch (error) {
			setStatus({ kind: "error", message: toUserMessage(error) });
		}
	}

	function handleSample() {
		show(verifyAnalysis(SAMPLE_ANALYSIS, SAMPLE_REPORT), true);
		setStatus({ kind: "idle" });
	}

	return (
		<div className="page">
			<header className="site-header">
				<h1>postmortem-lens</h1>
				<p className="tagline">
					他社の障害報告を、自社に当てはめる観点と、今とれる対策に分解する
				</p>
			</header>

			<main>
				<section className="about" aria-labelledby="about-heading">
					<h2 id="about-heading">このサービスについて</h2>
					<p>
						重要性の高い障害が発生した際、誰もが自分のサービスは大丈夫か？と考えるものです。しかし、ここにはいくつかの問題があると思います。
					</p>
					<ol>
						<li>そもそも重要性の高い障害が多く、拾いきれない</li>
						<li>重要性の高い障害に対して、今とれる対策がわからない</li>
					</ol>
					<p>
						1は仮にAIだとしても、そうした観点を持たなければ拾えません。このサービスはその観点と、実際の対策を提供します。
					</p>
					<p>
						障害報告の本文を貼ると、
						<strong>
							きっかけ・連鎖・封じ込めの失敗・復旧が遅れた理由・再発防止
						</strong>
						の5つの項目ごとに、決まった観点で本文を読み、本文からの引用・自社への問い・今とれる対策を出します。
					</p>
				</section>

				<ReportForm
					running={status.kind === "running"}
					onAnalyze={handleAnalyze}
					onSample={handleSample}
				/>

				{status.kind === "running" && (
					<p className="status" role="status">
						分解しています。長い報告では数分かかります（受け取った文字数:{" "}
						{status.receivedChars.toLocaleString()}）
					</p>
				)}
				{status.kind === "error" && (
					<p className="error" role="alert">
						{status.message}
					</p>
				)}

				{analysis && (
					<AnalysisView
						analysis={analysis}
						isSample={isSample}
						marks={marks}
						onMark={(viewpoint, mark) =>
							setMarks((prev) => ({ ...prev, [viewpoint]: mark }))
						}
					/>
				)}
			</main>

			<footer className="site-footer">
				<p>
					分解には
					Claude（Anthropic）を使います。引用は本文と突き合わせ、そのまま見つかったものだけを表示します。読み解き・問い・対策は
					AI が書いたもので、正しさは読み手が確かめてください。
				</p>
			</footer>
		</div>
	);
}
