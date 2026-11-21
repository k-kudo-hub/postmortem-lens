/**
 * 障害報告を読むときの観点の一覧。
 *
 * このサービスの中心はこの一覧である。重要な障害は多く、観点を持たずに読むと
 * 「自社は大丈夫か」に答えられないまま終わる。報告の中身にかかわらず、毎回同じ観点で読む。
 */

export const SECTIONS = [
	{
		id: "trigger",
		label: "きっかけ",
		description: "何が引き金になったか。原因は1つとは限らない",
	},
	{
		id: "cascade",
		label: "連鎖",
		description: "一部の故障が、どう全体に広がったか",
	},
	{
		id: "containment",
		label: "封じ込めの失敗",
		description: "広がりを止める仕組みと検知が、なぜ効かなかったか",
	},
	{
		id: "recovery",
		label: "復旧が遅れた理由",
		description: "直す手段が分かってから、元に戻るまでに何が邪魔をしたか",
	},
	{
		id: "prevention",
		label: "再発防止",
		description: "報告が挙げた対策のうち、持ち帰れるものと、書かれていない穴",
	},
] as const;

export type SectionId = (typeof SECTIONS)[number]["id"];

export type Viewpoint = {
	id: string;
	section: SectionId;
	/** 観点の短い名前 */
	title: string;
	/** 報告の中身にかかわらず、自社に当てはめる問い */
	question: string;
	/** この観点で読む理由 */
	why: string;
};

export const VIEWPOINTS = [
	{
		id: "trigger.latent-change",
		section: "trigger",
		title: "眠っていた変更",
		question:
			"数週間〜数か月前に入れた変更が、特定の負荷や機種の条件がそろって初めて表に出ることはないか。",
		why: "段階的な展開で問題が出なかった変更でも、条件がそろうまで潜んでいることがある。",
	},
	{
		id: "trigger.rollout-scope",
		section: "trigger",
		title: "一度に広げた変更",
		question:
			"デプロイや設定変更を、一部で様子を見ずに全体へ一度に広げていないか。広げる途中で異常に気づいて止められるか。",
		why: "変更を一度に全体へ広げると、欠陥がそのまま全体の障害になる。",
	},
	{
		id: "trigger.external-dependency",
		section: "trigger",
		title: "外部への依存",
		question:
			"他社のサービス・証明書・DNS・ライブラリのように、自社で直せないものが止まったとき、自社のサービスはどこまで動き続けられるか。",
		why: "自社の変更がなくても、依存している外部のものが止まれば障害になる。",
	},
	{
		id: "trigger.normal-operation",
		section: "trigger",
		title: "設計どおりの動きが負荷を変える",
		question:
			"フェイルオーバー・自動切替・定期処理のような、設計どおりの動きが、別の系の負荷や通信の形を変えていないか。",
		why: "障害の引き金は、異常ではなく平常運用の動きであることが多い。",
	},
	{
		id: "trigger.reduced-capacity",
		section: "trigger",
		title: "欠けたままの容量",
		question:
			"一部の容量が欠けた状態を「余裕があるから」と残していないか。欠けた状態に別の負荷が重なったときの余裕を測っているか。",
		why: "単独では影響のない容量の目減りが、別の要因と重なると余裕を食いつぶす。",
	},
	{
		id: "trigger.test-gap",
		section: "trigger",
		title: "試験と本番の差",
		question:
			"負荷試験で使う機種・コア数・トラフィックの構成は、本番と同じか。",
		why: "試験環境で再現しない条件の欠陥は、本番で初めて見つかる。",
	},
	{
		id: "cascade.redistribution",
		section: "cascade",
		title: "振り分けが負荷を寄せる",
		question:
			"自動の振り分けやリトライが、残ったサーバーに負荷を寄せて、倒れる範囲を広げないか。",
		why: "故障を避けるための振り分けが、同じ量の負荷を少ない台数に集めて連鎖を起こす。",
	},
	{
		id: "cascade.shared-defect",
		section: "cascade",
		title: "振り分け先も同じ弱点を持つ",
		question:
			"振り分け先や待機系が同じコード・設定で動いていて、同じ条件で倒れないか。",
		why: "冗長化していても、全台が同じ欠陥を持っていれば逃げ場にならない。",
	},
	{
		id: "cascade.shared-entry",
		section: "cascade",
		title: "共有している入口",
		question:
			"複数のサービスが同じ入口・基盤を共有していて、一方の動きがもう一方に響かないか。",
		why: "共有基盤は、関係のないサービスどうしの障害を結びつける。",
	},
	{
		id: "containment.bulkhead",
		section: "containment",
		title: "隔壁が効くか",
		question:
			"リージョン・セル・パーティションの隔壁は、実際に障害を止められることを試したか。",
		why: "隔壁は設計にあっても、別の問題で効かないことがある。",
	},
	{
		id: "containment.escape",
		section: "containment",
		title: "逃げ道があるか",
		question:
			"サービスごとに、壊れた基盤を迂回する経路があるか。迂回できないサービスはどれか。",
		why: "迂回できるサービスだけが早く戻り、迂回できないサービスが最後まで残る。",
	},
	{
		id: "containment.detection",
		section: "containment",
		title: "誰が先に気づいたか",
		question:
			"利用者への影響に先に気づくのは監視か、問い合わせ・外部の障害情報サイトか。前兆（一部のサーバーの故障）を拾えているか。",
		why: "前兆を拾えれば、全体に広がる前に手を打てる。",
	},
	{
		id: "containment.automation",
		section: "containment",
		title: "自動の対処が悪化させないか",
		question:
			"自動の緩和策が状況を悪くしているとき、それを止める判断の基準と手段があるか。",
		why: "平常時に効く自動の対処が、大規模な障害では負荷を広げる側に回る。",
	},
	{
		id: "recovery.reoverload",
		section: "recovery",
		title: "戻すとまた倒れる",
		question:
			"復旧したサーバーに溜まった要求が一気に押し寄せて、再び倒れないか。流量を段階的に戻す手段があるか。",
		why: "復旧の途中で再び倒れると、復旧にかかる時間が何倍にも延びる。",
	},
	{
		id: "recovery.rollback",
		section: "recovery",
		title: "巻き戻せない変更",
		question:
			"原因が数か月前の変更だったとき、ロールバックや機能フラグで戻せるか。",
		why: "古い変更は、その後の変更と重なって、すぐには巻き戻せない。",
	},
	{
		id: "recovery.auto-recovery-scope",
		section: "recovery",
		title: "自動復旧の想定外",
		question:
			"自動復旧は、大半のサーバーが同時に応答しない状態からの回復を想定しているか。",
		why: "一部の故障を前提にした自動復旧は、全体の故障では働かない。",
	},
	{
		id: "recovery.diagnosis",
		section: "recovery",
		title: "原因の特定にかかる時間",
		question:
			"原因の特定に必要なログ・計測（CPU・メモリ・ロックの待ち・接続プールの使用数）を、障害中にすぐ取れるか。",
		why: "原因が分かるまでの対処は手探りになり、効かない手を重ねる。",
	},
	{
		id: "recovery.backlog",
		section: "recovery",
		title: "溜まった処理の消化",
		question:
			"障害中にキューやバッチに溜まった処理を、復旧後にどれだけの時間で消化できるか。消化のあいだ、新しい処理が遅れないか。",
		why: "入口が戻っても、溜まった処理を消化しきるまで利用者への影響は続く。",
	},
	{
		id: "prevention.transferable",
		section: "prevention",
		title: "持ち帰れる再発防止策",
		question:
			"報告が挙げた再発防止策のうち、自社の設計にそのまま置き換えられるものはどれか。",
		why: "他社の対策は、自社の同じ箇所を見直すための具体的な手がかりになる。",
	},
	{
		id: "prevention.gap",
		section: "prevention",
		title: "書かれていない穴",
		question:
			"報告が見つけた問題のうち、再発防止策が書かれていないものはどれか。自社では同じ穴を塞げているか。",
		why: "報告の対策が触れていない問題こそ、読み手が自分で確かめる必要がある。",
	},
] as const satisfies readonly Viewpoint[];

export type ViewpointId = (typeof VIEWPOINTS)[number]["id"];

export const VIEWPOINT_IDS = VIEWPOINTS.map((v) => v.id) as [
	ViewpointId,
	...ViewpointId[],
];

export function viewpointsOf(section: SectionId): readonly Viewpoint[] {
	return VIEWPOINTS.filter((v) => v.section === section);
}

export function findViewpoint(id: string): Viewpoint | undefined {
	return VIEWPOINTS.find((v) => v.id === id);
}
