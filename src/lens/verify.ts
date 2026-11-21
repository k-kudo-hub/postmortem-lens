/** 根拠として認める引用の最短の長さ（正規化した後の文字数） */
const MIN_QUOTE_LENGTH = 8;

/**
 * 引用と本文を比べられる形にそろえる。
 * PDF やメールから写した本文は改行の位置・全角半角・引用符の形が揺れるため、それだけを無視する。
 */
export function normalize(text: string): string {
	return text
		.normalize("NFKC")
		.replace(/[‘’‚‛′]/g, "'")
		.replace(/[“”„‟″]/g, '"')
		.replace(/\s+/g, " ")
		.trim();
}

export function isQuoteInSource(quote: string, source: string): boolean {
	const q = normalize(quote);
	if (q.length < MIN_QUOTE_LENGTH) {
		return false;
	}
	return normalize(source).includes(q);
}
