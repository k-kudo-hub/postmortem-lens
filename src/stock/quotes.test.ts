/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isQuoteInSource } from "../lens/verify";
import { selectIncidents } from "./select";
import { STOCK } from "./stock";

/**
 * ストックの引用が、一次情報の本文にそのままあるかを確かめる。
 * 一次情報の本文は著作権があるためリポジトリに置かない。障害を足すときに、
 * 本文を `{SOURCES_DIR}/{障害の id}.txt` に保存してから `npm run verify-quotes` で走らせる。
 * `INCIDENT_IDS`（カンマ区切りの障害の id）を渡すと、その障害だけを突き合わせる。
 * PR で足した・変えた障害だけを確かめるときは `scripts/verify-changed-quotes.py` を使う。
 */
const sourcesDir = process.env.SOURCES_DIR;
const incidents = selectIncidents(STOCK, process.env.INCIDENT_IDS);

describe.skipIf(!sourcesDir)("ストックの引用と一次情報の突き合わせ", () => {
	for (const incident of incidents) {
		it(`${incident.id} の引用はすべて一次情報の本文にある`, () => {
			const path = join(sourcesDir ?? "", `${incident.id}.txt`);
			expect(existsSync(path), `${path} がありません`).toBe(true);
			const source = readFileSync(path, "utf8");
			const missing = incident.weaknesses.flatMap((w) =>
				[...w.quotes, ...w.reportedFixes]
					.filter((q) => !isQuoteInSource(q, source))
					.map((q) => `${w.id}: ${q}`),
			);
			expect(missing).toEqual([]);
		});
	}
});
