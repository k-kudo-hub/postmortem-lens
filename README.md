# postmortem-lens

直近の大規模障害のストックで、自分のサービスや OSS の**弱い箇所**と、その**重要性**に気づくための Claude Code のプラグインです。

ストックの一覧: https://k-kudo-hub.github.io/postmortem-lens/

## 使う人

自分のサービスや OSS を公開していて、他社の大規模障害と同じ起き方で止まらないかを知りたい開発者・SRE・プロダクトリード。

## できること

- 検査したいリポジトリで `/postmortem-lens:check` を実行すると、Claude がコードとインフラの設定（Kubernetes のマニフェスト・Helm のチャート・Terraform・docker-compose・CI/CD のワークフロー）を読み、ストックの障害と同じ起き方で止まりうる弱い箇所を出します
- 判定は「当てはまる」「対策済み」「当てはまらない」「判断できない」の4つです。当てはまる弱い箇所は重要な順に並び、それぞれに次が付きます
  - 重要度（高・中・低）と、その理由（起きたときの影響の広さ・条件のそろいやすさ）
  - 根拠になるファイルと行
  - 同じ起き方をした障害と、その報告からの引用（報告が挙げた対策があれば、それも引用します）
  - 今とれる対策と、今日から始められる最初の一歩（報告の対策を、postmortem-lens が利用者のリポジトリ向けに一般化したもの）
- 対策済み・当てはまらない・判断できない箇所と、ストックの外で気づいたことも出します

実行例: [GoogleCloudPlatform/microservices-demo を検査した結果](examples/microservices-demo.md)

### Dependabot との違い

| | Dependabot | postmortem-lens |
|---|---|---|
| 見るもの | 依存パッケージの名前と版 | コードとインフラの設定の作り方（振り分け・再送・ヘルスチェック・隔壁・ロールバックの手段） |
| 照らし合わせる相手 | 既知の脆弱性のデータベース | 他社で実際に起きた大規模障害の起き方 |
| 見つけるもの | 脆弱性が報告された版のライブラリ | 他社と同じ起き方で止まりうる箇所 |

ライブラリの既知の脆弱性（CVE）は対象外です。Dependabot のような脆弱性スキャナーと併せて使ってください。

## 使い方

Claude Code v2.1.275 以降で、次を実行してプラグインを入れます。

```text
/plugin install postmortem-lens --marketplace k-kudo-hub/postmortem-lens
```

それより前の版では、2つに分けて実行します。

```text
/plugin marketplace add k-kudo-hub/postmortem-lens
/plugin install postmortem-lens@postmortem-lens
```

検査したいリポジトリで Claude Code を開き、実行します。

```text
/postmortem-lens:check
```

- 検査は利用者の Claude Code の中で動きます。読んだファイルは、ふだん Claude Code を使うときと同じく Claude（Anthropic）に送られます。スキルは、それ以外の Web に送らないよう指示しています。postmortem-lens にサーバーはありません。費用は利用者の Claude Code の利用枠に収まります
- スキルは、ファイルを読むだけで、書き換えや Web への送信をしないよう指示しています（ファイルの一覧を見るために `git ls-files` のような読むだけのコマンドを実行することはあります）
- ストックは毎週足していきます。プラグインは版を固定していないので、更新すると新しいストックで検査できます

## 障害のストック

`plugin/stock/` に、1件の障害を1つの JSON で置いています。障害ごとに、一次報告の出典・要約と、障害を起こした弱い箇所を持ちます。弱い箇所には、観点・何が起きたか・報告からの引用・報告が挙げた対策（引用）・リポジトリで探すもの・今とれる対策（postmortem-lens が一般化したもの）があります。形は [`src/stock/schema.ts`](src/stock/schema.ts)、観点の一覧は [`src/lens/viewpoints.ts`](src/lens/viewpoints.ts) にあります。

- 事業者が自分で公開した一次報告だけを集めています
- 引用は、一次報告の本文と機械的に突き合わせ、そのまま見つかったものだけを置いています。一次報告の本文は著作権があるためリポジトリに置いていません
- 毎週、クラウドの Claude Code ルーチンが [`routine/add-incidents.md`](routine/add-incidents.md) の手順で新しい一次報告を探し、ストックに足す PR を作ります

## 分かっている制限

- 弱い箇所の判定と重要度は Claude が書いたものです。根拠のファイルと行を開いて、正しさを確かめてください
- インフラの設定が別のリポジトリにある場合、その部分は「判断できない」になります
- ストックにない起き方の弱い箇所は見つけません

## 開発

Node.js 22 以上で動きます（CI と公開には Node.js 24 を使っています）。

```bash
npm install
npm run dev      # ストックの一覧のページを http://localhost:5173/ で開く
```

| コマンド | すること |
|----------|----------|
| `npm test` | テスト（Vitest）。ストックがスキーマに合っているかも確かめる |
| `SOURCES_DIR=… npm run verify-quotes` | ストックの引用を一次報告の本文と突き合わせる。本文を `{SOURCES_DIR}/{障害の id}.txt` に置いて実行する |
| `npm run typecheck` | 型チェック |
| `npm run lint` | Lint と Format の確認（Biome） |
| `npm run build` | ストックの一覧のページを `dist/` にビルドする |
| `claude plugin validate ./plugin` | プラグインの設定を検証する |

手元でプラグインを試すときは、検査したいリポジトリで `claude --plugin-dir {このリポジトリ}/plugin` を実行してから `/postmortem-lens:check` を実行します。

### 公開のしくみ

`main` に push すると、GitHub Actions（`.github/workflows/deploy.yml`）がストックの一覧のページを GitHub Pages に公開します。
GitHub Free では private のリポジトリで GitHub Pages を使えないため、リポジトリが public のときだけ動きます。
初めて公開するときは、リポジトリの Settings → Pages で Source を「GitHub Actions」にします。

## ライセンス

MIT（引用した報告の文の著作権は各事業者にあります）
