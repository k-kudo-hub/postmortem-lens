import { describe, expect, it } from "vitest";
import { isQuoteInSource } from "./verify";

const source = `Root Cause
The incident was caused by three main factors.
First, a latent defect caused Windows servers to become
overwhelmed and unresponsive under certain load conditions.
Teams failed over from the alternative networking gateway to the ‘primary’ gateway.`;

describe("isQuoteInSource", () => {
	it("本文にそのままある文字列を見つける", () => {
		expect(
			isQuoteInSource("The incident was caused by three main factors.", source),
		).toBe(true);
	});

	it("改行と空白の違いは無視する（PDF から写した本文の改行位置が違っても見つける）", () => {
		expect(
			isQuoteInSource(
				"a latent defect caused Windows servers to become overwhelmed and unresponsive",
				source,
			),
		).toBe(true);
	});

	it("引用符の形の違い（‘’ と ''）は無視する", () => {
		expect(isQuoteInSource("to the 'primary' gateway", source)).toBe(true);
	});

	it("言い換え・要約された文字列は見つからない", () => {
		expect(
			isQuoteInSource("A latent bug made the servers unresponsive.", source),
		).toBe(false);
	});

	it("空の文字列と短すぎる文字列は根拠として認めない", () => {
		expect(isQuoteInSource("", source)).toBe(false);
		expect(isQuoteInSource("the", source)).toBe(false);
	});
});
