import { describe, expect, it } from "vitest";
import { VIEWPOINT_IDS } from "../lens/viewpoints";
import { incidentSchema } from "./schema";
import { parseStock, STOCK } from "./stock";

const valid = {
	id: "2026-01-01-example-outage",
	title: "例の障害",
	provider: "Example",
	service: "Example Service",
	startedAt: "2026-01-01",
	duration: "約2時間",
	source: {
		title: "Post Incident Review",
		url: "https://example.com/pir",
		publisher: "Example",
	},
	summary: "要約",
	weaknesses: [
		{
			id: "retry-storm",
			viewpoint: "cascade.redistribution",
			title: "間隔を空けない再送",
			whatHappened: "再送が負荷を押し上げた",
			quotes: ["client retries added further requests"],
			reportedFixes: ["We are adding additional throttling and rate limiting"],
			lookFor: ["HTTP クライアントの再送の設定で、間隔を延ばしていないもの"],
			countermeasures: [
				{ action: "指数バックオフにする", firstStep: "再送の設定を一覧にする" },
			],
		},
	],
};

describe("ストックのスキーマ", () => {
	it("障害・弱い箇所・引用・リポジトリで探すもの・対策がそろったものを受け付ける", () => {
		expect(incidentSchema.safeParse(valid).success).toBe(true);
	});

	it("引用・リポジトリで探すもの・対策のない弱い箇所は受け付けない", () => {
		for (const key of ["quotes", "lookFor", "countermeasures"] as const) {
			const broken = {
				...valid,
				weaknesses: [{ ...valid.weaknesses[0], [key]: [] }],
			};
			expect(incidentSchema.safeParse(broken).success, key).toBe(false);
		}
	});

	it("報告が挙げた対策は、なくても受け付ける", () => {
		const noFix = {
			...valid,
			weaknesses: [{ ...valid.weaknesses[0], reportedFixes: [] }],
		};
		expect(incidentSchema.safeParse(noFix).success).toBe(true);
	});

	it("出典の URL は https だけを受け付ける", () => {
		for (const url of ["javascript:alert(1)", "http://example.com/pir"]) {
			const broken = { ...valid, source: { ...valid.source, url } };
			expect(incidentSchema.safeParse(broken).success, url).toBe(false);
		}
	});

	it("Azure の履歴ページを出典にするときは、Tracking ID 付きのリンクだけを受け付ける", () => {
		const withSource = (url: string) => ({
			...valid,
			source: { ...valid.source, url },
		});
		const base = "https://azure.status.microsoft/en-us/status/history/";
		expect(
			incidentSchema.safeParse(withSource(`${base}?trackingId=7Q30-010`))
				.success,
		).toBe(true);
		for (const url of [base, `${base}?trackingId=`, `${base}#7Q30-010`]) {
			expect(incidentSchema.safeParse(withSource(url)).success, url).toBe(
				false,
			);
		}
	});

	it("障害の中で、弱い箇所の id が重なるものは受け付けない", () => {
		const broken = {
			...valid,
			weaknesses: [valid.weaknesses[0], valid.weaknesses[0]],
		};
		expect(incidentSchema.safeParse(broken).success).toBe(false);
	});

	it("観点の一覧にない観点は受け付けない", () => {
		const broken = {
			...valid,
			weaknesses: [{ ...valid.weaknesses[0], viewpoint: "unknown" }],
		};
		expect(incidentSchema.safeParse(broken).success).toBe(false);
	});
});

describe("ストック", () => {
	it("2026年に起きた障害を5件以上持ち、Microsoft 365 の障害を含む", () => {
		expect(STOCK.length).toBeGreaterThanOrEqual(5);
		expect(STOCK.every((i) => i.startedAt.startsWith("2026-"))).toBe(true);
		expect(STOCK.some((i) => i.service === "Microsoft 365")).toBe(true);
	});

	it("障害の id は重ならない", () => {
		const ids = STOCK.map((i) => i.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("ファイル名と id が違う障害は読み込まない", () => {
		expect(() =>
			parseStock({ "../../plugin/stock/wrong-name.json": valid }),
		).toThrow(/ファイル名/);
	});

	it("発生日の新しい順に並べる", () => {
		const older = {
			...valid,
			id: "2026-01-01-example-outage",
			startedAt: "2026-01-01",
		};
		const newer = {
			...valid,
			id: "2026-03-01-example-outage",
			startedAt: "2026-03-01",
		};
		const stock = parseStock({
			"../../plugin/stock/2026-01-01-example-outage.json": older,
			"../../plugin/stock/2026-03-01-example-outage.json": newer,
		});
		expect(stock.map((i) => i.id)).toEqual([newer.id, older.id]);
	});

	it("弱い箇所の観点は、すべて観点の一覧にある", () => {
		for (const incident of STOCK) {
			for (const w of incident.weaknesses) {
				expect(VIEWPOINT_IDS).toContain(w.viewpoint);
			}
		}
	});
});
