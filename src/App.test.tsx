import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { verifyAnalysis } from "./lens/verify";
import { SAMPLE_ANALYSIS } from "./sample/analysis";
import { SAMPLE_REPORT } from "./sample/report";

const analyzeReport = vi.fn();
vi.mock("./lens/analyze", async (importOriginal) => {
	const original = await importOriginal<typeof import("./lens/analyze")>();
	return {
		...original,
		analyzeReport: (...args: unknown[]) => analyzeReport(...args),
		createClient: vi.fn(() => ({})),
	};
});

beforeEach(() => {
	analyzeReport.mockReset();
	localStorage.clear();
});

describe("画面", () => {
	it("見本を見ると、API キーなしで5つの項目に分解した結果が出る", async () => {
		const user = userEvent.setup();
		render(<App />);
		await user.click(screen.getByRole("button", { name: /見本を見る/ }));

		for (const label of [
			"きっかけ",
			"連鎖",
			"封じ込めの失敗",
			"復旧が遅れた理由",
			"再発防止",
		]) {
			expect(
				screen.getByRole("heading", { level: 3, name: new RegExp(label) }),
			).toBeInTheDocument();
		}
		expect(
			screen.getByText("1つ目は、8月に入れた接続プールの設定変更である。"),
		).toBeInTheDocument();
		expect(analyzeReport).not.toHaveBeenCalled();
	});

	it("本文と API キーを入れて分解すると、結果が出る", async () => {
		analyzeReport.mockResolvedValue(
			verifyAnalysis(SAMPLE_ANALYSIS, SAMPLE_REPORT),
		);
		const user = userEvent.setup();
		render(<App />);
		await user.type(screen.getByLabelText("Claude API キー"), "sk-ant-test");
		await user.click(screen.getByLabelText("障害報告の本文"));
		await user.paste(SAMPLE_REPORT);
		await user.click(screen.getByRole("button", { name: "分解する" }));

		expect(
			await screen.findByRole("heading", {
				level: 2,
				name: /Example Pay 決済 API 障害/,
			}),
		).toBeInTheDocument();
		expect(analyzeReport).toHaveBeenCalledWith(
			expect.objectContaining({ report: SAMPLE_REPORT }),
		);
	});

	it("API キーがないと分解のボタンを押せない", async () => {
		const user = userEvent.setup();
		render(<App />);
		await user.click(screen.getByLabelText("障害報告の本文"));
		await user.paste("本文");
		expect(screen.getByRole("button", { name: "分解する" })).toBeDisabled();
	});

	it("失敗したときは、次に何をすればよいかを表示する", async () => {
		const { AnalysisError } = await import("./lens/analyze");
		analyzeReport.mockRejectedValue(
			new AnalysisError("出力が途中で切れました。"),
		);
		const user = userEvent.setup();
		render(<App />);
		await user.type(screen.getByLabelText("Claude API キー"), "sk-ant-test");
		await user.click(screen.getByLabelText("障害報告の本文"));
		await user.paste("本文");
		await user.click(screen.getByRole("button", { name: "分解する" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"出力が途中で切れました。",
		);
	});

	it("当てはまると印を付けた観点が、会議用の Markdown に入る", async () => {
		const user = userEvent.setup();
		render(<App />);
		await user.click(screen.getByRole("button", { name: /見本を見る/ }));

		const card = screen.getByRole("article", { name: "眠っていた変更" });
		await user.click(within(card).getByRole("radio", { name: "当てはまる" }));

		const markdown = screen.getByLabelText(
			"会議用の Markdown",
		) as HTMLTextAreaElement;
		expect(markdown.value.split("## 当てはまる")[1]).toContain(
			"きっかけ: 眠っていた変更",
		);
	});

	it("記述のなかった観点も、問いだけは一覧で見られる", async () => {
		const user = userEvent.setup();
		render(<App />);
		await user.click(screen.getByRole("button", { name: /見本を見る/ }));
		expect(
			screen.getByText(/この報告に記述がなかった観点/),
		).toBeInTheDocument();
		expect(screen.getByText("欠けたままの容量")).toBeInTheDocument();
	});
});
