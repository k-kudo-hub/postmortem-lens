"""PR で足した・変えた障害だけについて、引用を一次報告の本文と突き合わせる。

週次 PR の CI と、ルーチンが PR を作る前の確認で使う。既存の障害は突き合わせない
（一次報告の本文はリポジトリに置かないため、確かめるたびに取得し直すことになり、
Azure status history のように古い報告が消える出どころでは失敗し続けるため）。

使い方:
    python3 scripts/verify-changed-quotes.py {ベースのブランチ}   # 例: origin/main

- ベースとの分岐点から、`plugin/stock/*.json` で足した・変えたもの（コミットしていない新しいファイルを含む）を選ぶ
- 障害ごとに `source.url` の本文を scripts/fetch-source.py で一時ディレクトリに取得する。本文はリポジトリに保存しない
- `SOURCES_DIR` と `INCIDENT_IDS` を渡して `npm run verify-quotes` を走らせる
- 足した・変えた障害がなければ、何もせずに成功する
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path, PurePosixPath

STOCK_DIR = PurePosixPath("plugin/stock")
SCRIPTS_DIR = Path(__file__).resolve().parent


def stock_ids(paths: list[str]) -> list[str]:
    """リポジトリの中のパスのうち、ストックの障害のファイル（plugin/stock/*.json）を障害の id にする。"""
    ids = {
        PurePosixPath(p).stem
        for p in paths
        if PurePosixPath(p).parent == STOCK_DIR and PurePosixPath(p).suffix == ".json"
    }
    return sorted(ids)


def _git(root: Path, *args: str) -> list[str]:
    out = subprocess.run(
        ["git", *args], cwd=root, check=True, capture_output=True, text=True
    ).stdout
    return [line for line in out.splitlines() if line]


def changed_stock_ids(base: str, root: Path) -> list[str]:
    """ベースとの分岐点から、足した・変えた障害の id を返す。"""
    merge_base = _git(root, "merge-base", base, "HEAD")[0]
    changed = _git(
        root, "diff", "--name-only", "--diff-filter=AMR", merge_base, "--", str(STOCK_DIR)
    )
    untracked = _git(root, "ls-files", "--others", "--exclude-standard", "--", str(STOCK_DIR))
    return stock_ids(changed + untracked)


def source_args(ids: list[str], root: Path) -> list[str]:
    """fetch-source.py に渡す `{障害の id}={一次報告の URL}` の引数を作る。"""
    args = []
    for incident_id in ids:
        data = json.loads((root / STOCK_DIR / f"{incident_id}.json").read_text())
        args.append(f"{incident_id}={data['source']['url']}")
    return args


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    root = Path(_git(Path.cwd(), "rev-parse", "--show-toplevel")[0])
    ids = changed_stock_ids(sys.argv[1], root)
    if not ids:
        print("足した・変えた障害がないため、引用の突き合わせは行わない")
        return
    print(f"突き合わせる障害: {', '.join(ids)}")
    with tempfile.TemporaryDirectory(prefix="postmortem-sources-") as sources:
        subprocess.run(
            [sys.executable, str(SCRIPTS_DIR / "fetch-source.py"), sources, *source_args(ids, root)],
            check=True,
        )
        env = {**os.environ, "SOURCES_DIR": sources, "INCIDENT_IDS": ",".join(ids)}
        result = subprocess.run(["npm", "run", "verify-quotes"], cwd=root, env=env)
    sys.exit(result.returncode)


if __name__ == "__main__":
    main()
