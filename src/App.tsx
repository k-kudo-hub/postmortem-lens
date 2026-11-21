import { IncidentCard } from "./components/IncidentCard";
import { STOCK } from "./stock/stock";

const INSTALL =
	"/plugin install postmortem-lens --marketplace k-kudo-hub/postmortem-lens";
const RUN = "/postmortem-lens:check";
const MARKETPLACE_ADD = "/plugin marketplace add k-kudo-hub/postmortem-lens";
const INSTALL_OLD = "/plugin install postmortem-lens@postmortem-lens";

export default function App() {
	const weaknessCount = STOCK.reduce((n, i) => n + i.weaknesses.length, 0);

	return (
		<div className="page">
			<header className="site-header">
				<h1>postmortem-lens</h1>
				<p className="tagline">
					直近の大規模障害のストックで、自分のサービスの弱い箇所とその重要性に気づく
				</p>
			</header>

			<main>
				<section className="howto" aria-labelledby="howto-heading">
					<h2 id="howto-heading">使い方</h2>
					<p>
						Claude Code のプラグインです。自分のサービスや OSS
						のリポジトリで実行すると、下のストックの障害と同じ起き方で止まりうる弱い箇所を、重要な順に、根拠のファイルと行・障害の報告からの引用・今とれる対策つきで出します。
					</p>
					<ol>
						<li>
							Claude Code で入れる
							<pre>
								<code>{INSTALL}</code>
							</pre>
						</li>
						<li>
							検査したいリポジトリで Claude Code を開き、実行する
							<pre>
								<code>{RUN}</code>
							</pre>
						</li>
					</ol>
					<p className="hint">
						Claude Code v2.1.275 より前の版では、2つに分けて入れます:{" "}
						<code>{MARKETPLACE_ADD}</code> のあとに <code>{INSTALL_OLD}</code>
					</p>
					<p className="hint">
						検査は利用者の Claude Code の中で動きます。読んだファイルは、ふだん
						Claude Code を使うときと同じく
						Claude（Anthropic）に送られます。スキルは、それ以外の Web
						に送らないよう、ファイルを読むだけで書き換えないよう指示しています。postmortem-lens
						にサーバーはありません。ライブラリの既知の脆弱性（CVE）は対象外です。それは
						Dependabot のような脆弱性スキャナーで確かめてください。
					</p>
				</section>

				<section className="stock" aria-labelledby="stock-heading">
					<h2 id="stock-heading">障害のストック</h2>
					<p className="hint">
						{STOCK.length} 件の障害・{weaknessCount}{" "}
						個の弱い箇所。事業者が公開した一次報告だけを集め、引用は報告の本文と突き合わせています。毎週足していきます。
					</p>
					{STOCK.map((incident) => (
						<IncidentCard key={incident.id} incident={incident} />
					))}
				</section>
			</main>

			<footer className="site-footer">
				<p>
					引用（報告の本文と、報告が挙げた対策）の著作権は各事業者にあります。弱い箇所の読み解き・リポジトリで探すもの・今とれる対策は
					postmortem-lens が書いたもので、正しさは読み手が確かめてください。
				</p>
				<p>
					<a href="https://github.com/k-kudo-hub/postmortem-lens">GitHub</a>
				</p>
			</footer>
		</div>
	);
}
