import { type Incident, incidentSchema } from "./schema";

/** plugin/stock/ の JSON を読み込む。検査するスキルと公開ページが同じストックを使う */
const files = import.meta.glob<Incident>("../../plugin/stock/*.json", {
	eager: true,
	import: "default",
});

/** ファイルのパスと中身から、検証して新しい順に並べたストックを作る */
export function parseStock(entries: Record<string, unknown>): Incident[] {
	return Object.entries(entries)
		.map(([path, data]) => {
			const incident = incidentSchema.parse(data);
			const fileId = path
				.split("/")
				.pop()
				?.replace(/\.json$/, "");
			if (fileId !== incident.id) {
				throw new Error(`${path}: id（${incident.id}）がファイル名と違います`);
			}
			return incident;
		})
		.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/** 新しい順のストック */
export const STOCK: Incident[] = parseStock(files);
