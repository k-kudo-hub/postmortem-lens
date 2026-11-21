import type { Analysis } from "../lens/schema";

/**
 * 見本の障害報告（架空）を、このサービスの出力の形に分解した例。
 * API キーなしで画面を試すために使う。引用は SAMPLE_REPORT の文字列をそのまま写している。
 */
export const SAMPLE_ANALYSIS: Analysis = {
	incident: "Example Pay 決済 API 障害（2026年10月3日・架空の見本）",
	summary:
		"8月の接続プールの設定変更が持っていた欠陥に、同日のバッチ移行による負荷が重なり、決済 API のサーバーが次々に応答しなくなった。ロードバランサーの切り離しと加盟店端末の再送が連鎖を広げ、約4時間半、決済が失敗した。設定を戻せず、再送の押し寄せで復旧も遅れた。",
	findings: [
		{
			viewpoint: "trigger.latent-change",
			mentioned: true,
			quotes: [
				"1つ目は、8月に入れた接続プールの設定変更である。",
				"8月の展開から2か月間、問題は起きていなかった。",
			],
			reading:
				"2か月前の接続プールの設定変更が、データベースへの接続数が上限に近づく条件で待ちを一気に増やした。",
			question:
				"自社で直近数か月に入れた接続数・タイムアウト・プールの設定変更のうち、上限付近でしか試していないものはないか。",
			actions: [
				{
					action:
						"接続プールやタイムアウトの設定変更を、上限付近の負荷で試してから展開する手順にする",
					first_step:
						"直近3か月の設定変更の一覧を出し、上限付近で試したかどうかを確かめる",
				},
			],
		},
		{
			viewpoint: "trigger.normal-operation",
			mentioned: true,
			quotes: [
				"売上集計のバッチを、決済 API と同じデータベースの読み取り用レプリカに移した。",
				"この移行は計画どおりだったが、決済 API の読み取りと同じレプリカに負荷が重なった。",
			],
			reading:
				"計画どおりのバッチ移行が、決済 API の読み取りと同じレプリカに負荷を重ねた。",
			question:
				"自社のバッチやデータ移行は、利用者向けの API と同じデータベース・レプリカを使っていないか。",
			actions: [
				{
					action:
						"バッチと利用者向け API が同じデータベース・レプリカを共有している箇所を洗い出し、分ける",
					first_step:
						"バッチの接続先の一覧を作り、API の接続先と重なるものに印を付ける",
				},
			],
		},
		{
			viewpoint: "trigger.reduced-capacity",
			mentioned: false,
			quotes: [],
			reading: "",
			question: "",
			actions: [],
		},
		{
			viewpoint: "trigger.test-gap",
			mentioned: true,
			quotes: [
				"負荷試験はピーク時の半分の流量で行っており、この条件に届いていなかった。",
			],
			reading:
				"負荷試験の流量がピーク時の半分で、欠陥が表に出る条件に届いていなかった。",
			question: "自社の負荷試験の流量は、本番のピークを上回っているか。",
			actions: [
				{
					action: "負荷試験の流量の基準を、本番のピークより上に置く",
					first_step:
						"直近の負荷試験の流量と、本番の過去3か月のピークの流量を並べて比べる",
				},
			],
		},
		{
			viewpoint: "cascade.redistribution",
			mentioned: true,
			quotes: [
				"ロードバランサーは失敗したサーバーを外し、残りのサーバーに流量を寄せた。",
				"加盟店の端末は、タイムアウトすると3秒ごとに再送する作りになっており、再送が流量を通常の約3倍に押し上げた。",
			],
			reading:
				"切り離しで残りのサーバーに流量が寄り、端末の3秒ごとの再送が流量を約3倍にした。",
			question:
				"自社のロードバランサーの切り離しとクライアントの再送は、残ったサーバーに負荷を寄せて連鎖を広げないか。",
			actions: [
				{
					action:
						"一度に切り離せるサーバーの割合に上限を設け、上限を超えたら切り離しを止める",
					first_step:
						"ロードバランサーのヘルスチェックの設定で、全台が外れうるかを確かめる",
				},
				{
					action:
						"自社のクライアントの再送を、失敗のたびに間隔を延ばす方式（指数バックオフとジッター）にする",
					first_step:
						"自社のクライアント・SDK の再送の間隔と回数の設定を一覧にする",
				},
			],
		},
		{
			viewpoint: "cascade.shared-defect",
			mentioned: true,
			quotes: [
				"残りのサーバーも同じ設定で動いていたため、同じ条件で次々にヘルスチェックに失敗した。",
			],
			reading:
				"全サーバーが同じ設定で動いていたため、切り離した先でも同じ条件で倒れた。",
			question:
				"自社の設定変更は全台に同時に入っていて、同じ条件で全台が倒れる状態になっていないか。",
			actions: [
				{
					action:
						"設定変更を一部のサーバーだけに入れた状態を一定期間保ち、全台に揃えない期間を作る",
					first_step:
						"設定変更の展開手順に、一部だけに入れる段階があるかを確かめる",
				},
			],
		},
		{
			viewpoint: "cascade.shared-entry",
			mentioned: false,
			quotes: [],
			reading: "",
			question: "",
			actions: [],
		},
		{
			viewpoint: "containment.bulkhead",
			mentioned: false,
			quotes: [],
			reading: "",
			question: "",
			actions: [],
		},
		{
			viewpoint: "containment.escape",
			mentioned: false,
			quotes: [],
			reading: "",
			question: "",
			actions: [],
		},
		{
			viewpoint: "containment.detection",
			mentioned: true,
			quotes: [
				"最初に異常に気づいたのは、19時20分の加盟店からの問い合わせだった。",
				"監視はエラー率の5分平均でアラートを出す設定で、アラートが鳴ったのは19時25分だった。",
			],
			reading:
				"異常に最初に気づいたのは加盟店の問い合わせで、監視のアラートは5分平均のため遅れた。",
			question:
				"自社の監視は、利用者からの問い合わせより先に異常を知らせられるか。前兆（一部のサーバーのヘルスチェック失敗）を拾っているか。",
			actions: [
				{
					action:
						"ヘルスチェックに失敗したサーバーの割合を、エラー率とは別にアラートの条件にする",
					first_step:
						"直近の障害で、問い合わせとアラートのどちらが先だったかを記録から確かめる",
				},
			],
		},
		{
			viewpoint: "containment.automation",
			mentioned: false,
			quotes: [],
			reading: "",
			question: "",
			actions: [],
		},
		{
			viewpoint: "recovery.reoverload",
			mentioned: true,
			quotes: [
				"切り離したサーバーを戻すと、溜まっていた再送が一気に押し寄せ、数分で再びヘルスチェックに失敗した。",
				"22時30分に、加盟店からの流量を段階的に受け入れる制限をかけてから、サーバーを少しずつ戻した。",
			],
			reading:
				"戻したサーバーに溜まった再送が押し寄せて再び倒れ、流量の制限をかけてから段階的に戻した。",
			question:
				"自社には、復旧時に流量を段階的に受け入れる手段（流量の制限・受け付けの絞り込み）が用意されているか。",
			actions: [
				{
					action:
						"入口で流量を段階的に受け入れる制限を、障害時にすぐかけられる手順として用意する",
					first_step:
						"流量の制限をかける設定の場所と、かけられる権限を持つ人を確かめる",
				},
			],
		},
		{
			viewpoint: "recovery.rollback",
			mentioned: true,
			quotes: [
				"設定変更は2か月前のもので、その後に別の変更が3件重なっていたため、すぐには戻せなかった。",
			],
			reading:
				"原因の設定変更は2か月前のもので、後から3件の変更が重なり、すぐには戻せなかった。",
			question:
				"自社で数か月前の設定変更が原因だと分かったとき、その変更だけを戻せるか。",
			actions: [
				{
					action:
						"設定変更を機能フラグや個別の設定値として持ち、ほかの変更と切り離して戻せるようにする",
					first_step:
						"直近の設定変更を1つ選び、それだけを戻す手順を書き出せるか試す",
				},
			],
		},
		{
			viewpoint: "recovery.auto-recovery-scope",
			mentioned: false,
			quotes: [],
			reading: "",
			question: "",
			actions: [],
		},
		{
			viewpoint: "recovery.diagnosis",
			mentioned: true,
			quotes: ["21時10分に原因が接続プールの設定だと分かった。"],
			reading:
				"障害の発生から原因が接続プールの設定だと分かるまでに、約2時間かかった。",
			question:
				"自社では、接続プールの待ち・接続数を、障害中にすぐ見られるか。",
			actions: [
				{
					action:
						"接続プールの使用数と待ちの数を、常時見られるダッシュボードに置く",
					first_step:
						"いまのダッシュボードで、接続プールの使用数と待ちが見られるかを確かめる",
				},
			],
		},
		{
			viewpoint: "prevention.transferable",
			mentioned: true,
			quotes: [
				"負荷試験の流量を、ピーク時の1.5倍に引き上げる（11月中）",
				"バッチ処理は、決済 API と別のレプリカで動かす（完了）",
			],
			reading:
				"負荷試験の流量の引き上げと、バッチを別のレプリカで動かすことを再発防止策に挙げている。",
			question:
				"負荷試験の流量の基準と、バッチと API の接続先の分離は、自社でも決まっているか。",
			actions: [
				{
					action:
						"負荷試験の流量の基準（本番ピークの何倍か）を文書にして決める",
					first_step:
						"負荷試験の手順書に、流量の基準が書かれているかを確かめる",
				},
			],
		},
		{
			viewpoint: "prevention.gap",
			mentioned: true,
			quotes: [
				"最初に異常に気づいたのは、19時20分の加盟店からの問い合わせだった。",
				"ロードバランサーは失敗したサーバーを外し、残りのサーバーに流量を寄せた。",
			],
			reading:
				"監視が問い合わせより遅れたことと、ロードバランサーの切り離しが連鎖を広げたことには、再発防止策が書かれていない。",
			question:
				"自社では、検知の遅れと、切り離しによる連鎖の両方に手を打てているか。",
			actions: [
				{
					action:
						"検知の遅れと切り離しによる連鎖を、自社の障害訓練の項目に入れる",
					first_step:
						"次の障害訓練の計画に、この2つを確かめる場面があるかを見る",
				},
			],
		},
	],
};
