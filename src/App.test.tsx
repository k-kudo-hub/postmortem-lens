import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";
import { STOCK } from "./stock/stock";

describe("公開ページ", () => {
	it("プラグインの入れ方と使い方を載せる", () => {
		render(<App />);
		expect(
			screen.getByText(
				"/plugin install postmortem-lens --marketplace k-kudo-hub/postmortem-lens",
			),
		).toBeInTheDocument();
		expect(screen.getByText("/postmortem-lens:check")).toBeInTheDocument();
	});

	it("ストックの障害を新しい順にすべて並べる", () => {
		render(<App />);
		const titles = screen
			.getAllByRole("heading", { level: 3 })
			.map((h) => h.textContent);
		expect(titles).toEqual(STOCK.map((i) => i.title));
	});

	it("障害ごとに、出典へのリンクと弱い箇所（引用・探すもの・対策）を出す", async () => {
		const user = userEvent.setup();
		render(<App />);
		const incident = STOCK[0];
		const card = screen.getByRole("article", { name: incident.title });
		expect(within(card).getByRole("link", { name: /出典/ })).toHaveAttribute(
			"href",
			incident.source.url,
		);

		await user.click(within(card).getByText(/弱い箇所/));
		const weakness = incident.weaknesses[0];
		expect(within(card).getByText(weakness.title)).toBeInTheDocument();
		expect(within(card).getByText(weakness.quotes[0])).toBeInTheDocument();
		expect(within(card).getByText(weakness.lookFor[0])).toBeInTheDocument();
		expect(
			within(card).getByText(weakness.countermeasures[0].action),
		).toBeInTheDocument();
	});
});
