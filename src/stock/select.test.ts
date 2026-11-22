import { describe, expect, it } from "vitest";
import { selectIncidents } from "./select";

const stock = [{ id: "2026-01-02-b" }, { id: "2026-01-01-a" }];

describe("selectIncidents", () => {
	it("id の指定がなければ、すべての障害を返す", () => {
		expect(selectIncidents(stock, undefined)).toEqual(stock);
		expect(selectIncidents(stock, "")).toEqual(stock);
	});

	it("カンマで区切った id の障害だけを返す", () => {
		expect(selectIncidents(stock, "2026-01-01-a")).toEqual([
			{ id: "2026-01-01-a" },
		]);
		expect(selectIncidents(stock, " 2026-01-01-a , 2026-01-02-b ")).toEqual(
			stock,
		);
	});

	it("ストックにない id を指定したら止める", () => {
		expect(() => selectIncidents(stock, "2026-01-01-a,2026-01-03-c")).toThrow(
			"2026-01-03-c",
		);
	});
});
