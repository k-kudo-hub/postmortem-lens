import { type Incident, incidentSchema } from "./schema";

/** plugin/stock/ の JSON を読み込む。検査するスキルと公開ページが同じストックを使う */
const files = import.meta.glob<Incident>("../../plugin/stock/*.json", {
	eager: true,
	import: "default",
});

function load(): Incident[] {
	return Object.entries(files)
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
export const STOCK: Incident[] = load();
