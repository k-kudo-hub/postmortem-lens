/**
 * 突き合わせる障害を選ぶ。`ids` はカンマで区切った障害の id で、空ならすべてを選ぶ。
 * 週次 PR では、その PR で足した・変えた障害だけを突き合わせるために使う。
 */
export function selectIncidents<T extends { id: string }>(
	stock: T[],
	ids: string | undefined,
): T[] {
	const wanted = (ids ?? "")
		.split(",")
		.map((id) => id.trim())
		.filter((id) => id !== "");
	if (wanted.length === 0) {
		return stock;
	}
	const unknown = wanted.filter((id) => !stock.some((i) => i.id === id));
	if (unknown.length > 0) {
		throw new Error(`ストックにない障害です: ${unknown.join(", ")}`);
	}
	return stock.filter((i) => wanted.includes(i.id));
}
