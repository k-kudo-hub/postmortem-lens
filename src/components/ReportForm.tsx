import { type FormEvent, useId, useState } from "react";

const STORAGE_KEY = "postmortem-lens:api-key";

function loadKey(): string {
	try {
		return localStorage.getItem(STORAGE_KEY) ?? "";
	} catch {
		return "";
	}
}

function saveKey(key: string | null) {
	try {
		if (key) {
			localStorage.setItem(STORAGE_KEY, key);
		} else {
			localStorage.removeItem(STORAGE_KEY);
		}
	} catch {
		// 保存できない環境（プライベートウィンドウ）では、このページを開いている間だけ使う
	}
}

type Props = {
	running: boolean;
	onAnalyze: (report: string, apiKey: string) => void;
	onSample: () => void;
};

export function ReportForm({ running, onAnalyze, onSample }: Props) {
	const [report, setReport] = useState("");
	const [apiKey, setApiKey] = useState(loadKey);
	const [remember, setRemember] = useState(() => loadKey() !== "");
	const reportId = useId();
	const keyId = useId();
	const rememberId = useId();

	function handleSubmit(event: FormEvent) {
		event.preventDefault();
		saveKey(remember ? apiKey.trim() : null);
		onAnalyze(report, apiKey.trim());
	}

	const canSubmit = !running && report.trim() !== "" && apiKey.trim() !== "";

	return (
		<form className="report-form" onSubmit={handleSubmit}>
			<h2>障害報告を貼る</h2>
			<label htmlFor={reportId}>障害報告の本文</label>
			<textarea
				id={reportId}
				value={report}
				onChange={(e) => setReport(e.target.value)}
				rows={12}
				placeholder="事後報告（ポストモーテム）の本文を、そのまま貼ってください。英語の報告もそのまま貼れます。"
			/>

			<label htmlFor={keyId}>Claude API キー</label>
			<input
				id={keyId}
				type="password"
				autoComplete="off"
				value={apiKey}
				onChange={(e) => setApiKey(e.target.value)}
				placeholder="sk-ant-..."
			/>
			<div className="checkbox">
				<input
					id={rememberId}
					type="checkbox"
					checked={remember}
					onChange={(e) => {
						setRemember(e.target.checked);
						if (!e.target.checked) {
							saveKey(null);
						}
					}}
				/>
				<label htmlFor={rememberId}>このブラウザにキーを保存する</label>
			</div>
			<p className="hint">
				このサイトにサーバーはありません。キーと本文は、このブラウザから
				Anthropic の API にだけ送られ、料金はキーの持ち主に請求されます。キーは{" "}
				<a
					href="https://platform.claude.com/settings/keys"
					target="_blank"
					rel="noreferrer"
				>
					Claude Console
				</a>{" "}
				で作れます。
			</p>

			<div className="actions">
				<button type="submit" disabled={!canSubmit}>
					分解する
				</button>
				<button
					type="button"
					className="secondary"
					onClick={onSample}
					disabled={running}
				>
					見本を見る（API キー不要）
				</button>
			</div>
		</form>
	);
}
