"""一次報告の本文を、引用の突き合わせに使えるテキストとして保存する。

WebFetch はページをモデルが処理した結果を返すため、本文が一字一句そのままにならない。
引用の突き合わせ（npm run verify-quotes）には、このスクリプトで取った本文を使う。

使い方:
    python3 scripts/fetch-source.py {保存先のディレクトリ} {障害の id}={一次報告の URL} ...

- HTML はタグを除いてテキストにする
- PDF は pdftotext（poppler）でテキストにする。pdftotext がなければ止まる
- Google Cloud の incidents.json のような JSON は、そのまま保存する（必要な更新の本文を取り出して保存し直す）
"""

import html
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from pathlib import Path

UA = "Mozilla/5.0 (compatible; postmortem-lens-stock-updater)"


def html_to_text(raw: str) -> str:
    raw = re.sub(r"<(script|style|noscript|svg)[^>]*>.*?</\1>", " ", raw, flags=re.S | re.I)
    raw = re.sub(r"<br\s*/?>|</(p|div|li|h[1-6]|tr|pre|blockquote|section|article)>", "\n", raw, flags=re.I)
    raw = re.sub(r"<[^>]+>", "", raw)
    raw = html.unescape(raw)
    raw = re.sub(r"[ \t ]+", " ", raw)
    raw = re.sub(r"\n\s*\n+", "\n", raw)
    return raw.strip()


def pdf_to_text(body: bytes) -> str:
    if shutil.which("pdftotext") is None:
        sys.exit("pdftotext がありません。poppler を入れてから実行してください（例: apt-get install -y poppler-utils）")
    with tempfile.TemporaryDirectory() as tmp:
        pdf = Path(tmp) / "source.pdf"
        pdf.write_bytes(body)
        out = Path(tmp) / "source.txt"
        subprocess.run(["pdftotext", "-layout", str(pdf), str(out)], check=True)
        return out.read_text()


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    out_dir = Path(sys.argv[1])
    out_dir.mkdir(parents=True, exist_ok=True)
    for arg in sys.argv[2:]:
        name, url = arg.split("=", 1)
        if not url.startswith("https://"):
            sys.exit(f"{name}: https の URL だけを取得します（{url}）")
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "en-US"})
        with urllib.request.urlopen(req, timeout=30) as res:
            body = res.read()
            content_type = res.headers.get("Content-Type", "")
        if "pdf" in content_type or body[:5] == b"%PDF-":
            text = pdf_to_text(body)
        elif "json" in content_type or url.endswith(".json"):
            text = body.decode("utf-8", errors="replace")
        else:
            text = html_to_text(body.decode("utf-8", errors="replace"))
        (out_dir / f"{name}.txt").write_text(text)
        print(f"{name}: {len(text)} 文字を保存した")


if __name__ == "__main__":
    main()
