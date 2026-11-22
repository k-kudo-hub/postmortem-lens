"""verify-changed-quotes.py のテスト。python3 -m unittest discover -s scripts で走らせる。"""

import importlib.util
import json
import subprocess
import tempfile
import unittest
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "verify_changed_quotes", Path(__file__).with_name("verify-changed-quotes.py")
)
vcq = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(vcq)


def git(cwd: Path, *args: str) -> None:
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True)


def write_incident(root: Path, incident_id: str, url: str) -> None:
    path = root / "plugin" / "stock" / f"{incident_id}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"id": incident_id, "source": {"url": url}}))


class StockIdsTest(unittest.TestCase):
    def test_ストックの_json_だけを障害の_id_にする(self):
        paths = [
            "plugin/stock/2026-10-05-a.json",
            "plugin/stock/README.md",
            "plugin/skills/check/SKILL.md",
            "src/stock/stock.ts",
            "plugin/stock/2026-10-05-a.json",
            "plugin/stock/nested/2026-10-06-b.json",
        ]
        self.assertEqual(vcq.stock_ids(paths), ["2026-10-05-a"])


class ChangedStockIdsTest(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        git(self.root, "init", "-q", "-b", "main")
        git(self.root, "config", "user.email", "test@example.com")
        git(self.root, "config", "user.name", "test")
        write_incident(self.root, "2026-01-01-old", "https://example.com/old")
        write_incident(self.root, "2026-01-02-edited", "https://example.com/edited")
        git(self.root, "add", ".")
        git(self.root, "commit", "-q", "-m", "base")

    def tearDown(self):
        self._tmp.cleanup()

    def test_ベースから足した_変えた障害だけを選ぶ(self):
        git(self.root, "switch", "-q", "-c", "weekly")
        write_incident(self.root, "2026-01-03-added", "https://example.com/added")
        write_incident(self.root, "2026-01-02-edited", "https://example.com/edited2")
        git(self.root, "add", ".")
        git(self.root, "commit", "-q", "-m", "weekly")
        # コミットしていない新しいファイル（ルーチンが確かめてからコミットする場合）も選ぶ
        write_incident(self.root, "2026-01-04-untracked", "https://example.com/u")
        # ベースが先に進んでも、ベースだけで足された障害は選ばない
        git(self.root, "switch", "-q", "main")
        write_incident(self.root, "2026-01-05-main-only", "https://example.com/m")
        git(self.root, "add", "plugin/stock/2026-01-05-main-only.json")
        git(self.root, "commit", "-q", "-m", "main moves")
        git(self.root, "switch", "-q", "weekly")

        self.assertEqual(
            vcq.changed_stock_ids("main", self.root),
            ["2026-01-02-edited", "2026-01-03-added", "2026-01-04-untracked"],
        )

    def test_消しただけの障害は選ばない(self):
        git(self.root, "switch", "-q", "-c", "weekly")
        git(self.root, "rm", "-q", "plugin/stock/2026-01-01-old.json")
        git(self.root, "commit", "-q", "-m", "remove")
        self.assertEqual(vcq.changed_stock_ids("main", self.root), [])


class SourceArgsTest(unittest.TestCase):
    def test_障害ごとに一次報告の_url_を取得する引数を作る(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            write_incident(root, "2026-01-03-added", "https://example.com/added")
            self.assertEqual(
                vcq.source_args(["2026-01-03-added"], root),
                ["2026-01-03-added=https://example.com/added"],
            )


if __name__ == "__main__":
    unittest.main()
