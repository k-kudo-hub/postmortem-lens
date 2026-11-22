# 実行例: GoogleCloudPlatform/microservices-demo

公開されている OSS（[GoogleCloudPlatform/microservices-demo](https://github.com/GoogleCloudPlatform/microservices-demo)、コミット `c7cb6d5`）で `/postmortem-lens:check` を実行した結果（2026-11-21、このリポジトリのコミット `af760df` のプラグイン、障害6件・弱い箇所24個のストック）。出力をそのまま載せている。

---

# postmortem-lens の検査結果: microservices-demo（Online Boutique）

- 検査したもの: Google の Online Boutique。11個のマイクロサービスが gRPC でつながる EC のデモで、Kubernetes マニフェスト・Helm・Kustomize・Terraform で GKE へ載せる作りになっています
- 照らしたストック: 6件の障害・24個の弱い箇所（2026-02-20〜2026-11-12）
- 結果: 当てはまる 4・対策済み 2・当てはまらない 13・判断できない 5

## 弱い箇所（重要な順）

### 1. 【高】どの Deployment も1台で PodDisruptionBudget がなく、ノードの保守のあいだ frontend が止まる

- 重要度の理由: 影響の広さ A（入口の frontend が1台だけなので、その Pod が追い出されるとストア全体に届かなくなる）／条件のそろいやすさ 1（GKE Autopilot ではノードの更新やドレインは平常運用で起きる。README と Terraform はどちらも Autopilot を前提にしている）
- 根拠:
  - `kubernetes-manifests/frontend.yaml:21-25` — `replicas` を書いていないので1台になる。リポジトリ全体を Grep しても `PodDisruptionBudget`・`HorizontalPodAutoscaler`・`topologySpread` は1つもない（`release/` を除く。`replicas: 1` を明示しているのは loadgenerator と otel-collector だけ）

    ```yaml
    spec:
      selector:
        matchLabels:
          app: frontend
      template:
    ```
  - `kubernetes-manifests/cartservice.yaml:21-24`・`:95-98` — cartservice と redis-cart も同じく1台で、PDB もない
  - `terraform/main.tf:46` — `enable_autopilot = true`。ノードの保守は GKE の側で走る
- 同じ起き方をした障害:
  - [光ファイバーの保守で、Google Cloud の us-west1 の多くのサービスが劣化した障害](https://status.cloud.google.com/incidents/utF3FMFdQfwBzJcGG6vf)（2026-08-20、Google）: 予定していた光ファイバーの保守が、データセンター間の通信容量を想定外に減らし、自動の迂回も別の容量へうまく振り分けられなかった。
    > The disruption originated during scheduled fiber optic maintenance, which unexpectedly compromised network capacity between data centers within the us-west1 region.

    報告が挙げた対策:
    > Key focus areas include reforming scheduled maintenance protocols, establishing stricter safety checks and circuit redundancy requirements prior to routine maintenance, and refining automated regional traffic failover mechanisms to automatically handle sudden capacity degradation without incurring severe network congestion.
- 今とれる対策:
  - frontend・cartservice・productcatalogservice・currencyservice を2台以上にし、`minAvailable: 1` の PodDisruptionBudget を置いて、ノードの保守で全台が同時に追い出されないようにする（最初の一歩: `kubernetes-manifests/frontend.yaml` に `replicas: 2` を書き、同じディレクトリに frontend 用の PodDisruptionBudget を足す。Helm を使う場合は `helm-chart/templates/frontend.yaml` に同じものを入れる）

### 2. 【高】frontend と checkoutservice が、依存先の gRPC 呼び出しに期限を付けていない

- 重要度の理由: 影響の広さ A（トップページは currency・productcatalog・cart の3つが全部返らないと描画できないので、どれか1つが遅れるとトップ・商品・カートのページが応答しなくなる）／条件のそろいやすさ 2（依存先が1つ遅れるだけで起きる。productcatalogservice には遅延を注入する `EXTRA_LATENCY` まで用意されている）
- 根拠:
  - `src/frontend/rpc.go:45-49`・`:57-60` — 商品一覧とカートの取得は、リクエストの context をそのまま渡していて期限がない。期限があるのは広告の呼び出し（`rpc.go:120` の 100ms）だけ

    ```go
    func (fe *frontendServer) getProducts(ctx context.Context) ([]*pb.Product, error) {
    	resp, err := pb.NewProductCatalogServiceClient(fe.productCatalogSvcConn).
    		ListProducts(ctx, &pb.Empty{})
    ```
  - `src/frontend/main.go:171` — `http.ListenAndServe` を使っており、サーバー側にも読み書きの期限がない

    ```go
    log.Fatal(http.ListenAndServe(addr+":"+srvPort, handler))
    ```
  - `src/checkoutservice/main.go:360` — 通貨の換算は `context.TODO()` で呼んでいる。呼び出し元の期限もキャンセルも伝わらない

    ```go
    result, err := pb.NewCurrencyServiceClient(cs.currencySvcConn).Convert(context.TODO(), &pb.CurrencyConversionRequest{
    ```
  - `src/frontend/handlers.go:62-76` — 通貨・商品・カートのどれか1つが失敗すると、トップページ全体を 500 にする（機能を落として続ける作りがない）
- 同じ起き方をした障害:
  - [光ファイバーの保守で、Google Cloud の us-west1 の多くのサービスが劣化した障害](https://status.cloud.google.com/incidents/utF3FMFdQfwBzJcGG6vf)（2026-08-20、Google）: 通信の劣化で Spanner などの基盤サービスの遅れが急増し、それに依存する Cloud Storage・IAM・Persistent Disk・GKE がタイムアウトとエラーを出した。
    > Core infrastructure services, including Spanner Paxos consensus and the Unified Metadata Server (UMS), experienced significant latency spikes, which cascaded into timeouts and elevated error rates for downstream dependent products such as Cloud Storage, Cloud IAM, Persistent Disk, and Google Kubernetes Engine.
- 今とれる対策:
  - `rpc.go` の呼び出しすべてに、`getAd` と同じ形で `context.WithTimeout` を付ける。checkoutservice の `context.TODO()` は `ctx` に置き換える。カートの取得に失敗したときは、トップページを 500 にせずカートの件数を 0 として描画する（最初の一歩: `src/checkoutservice/main.go:360` の `context.TODO()` を `ctx` に直し、`src/frontend/rpc.go` の `getCurrencies`・`getProducts`・`getCart`・`convertCurrency` に期限を付ける）

### 3. 【高】cartservice のヘルスチェックが、Redis につながったかを確かめずに常に「正常」を返す

- 重要度の理由: 影響の広さ A（カートが失敗するとトップページと商品ページも 500 になるため、ストア全体が使えなくなる）／条件のそろいやすさ 2（新しい版の Pod が Redis に届かない状態で更新が流れると起きる。原因は `REDIS_ADDR` の誤りや NetworkPolicy の漏れ）。1台構成のローリング更新は、新しい Pod が Ready になった時点で古い Pod を止めるので、正しく動いていた古い版がなくなる
- 根拠:
  - `src/cartservice/src/cartstore/RedisCartStore.cs:106-116` — `Ping()` は何も確かめずに `true` を返す。`SpannerCartStore.cs:172-182` と `AlloyDBCartStore.cs:164-174` も同じ

    ```csharp
    public bool Ping()
    {
        try
        {
            return true;
        }
    ```
  - `src/cartservice/src/services/HealthCheckService.cs:37` — readiness と liveness が使う gRPC のヘルスチェックは、この `Ping()` の結果をそのまま返す
  - `kubernetes-manifests/cartservice.yaml:59-67` — readinessProbe はこのヘルスチェックを見ており、`minReadySeconds` もない
- 同じ起き方をした障害:
  - [止めていた更新が一斉に再開し、Azure のネットワークのコントロールプレーンがあふれた障害](https://azure.status.microsoft/en-us/status/history/?trackingId=7Q30-010)（2026-09-30、Microsoft）: 再起動したゲートウェイが、設定と経路の情報を戻しきる前に正常と判定され、冗長化した相方の更新が先に進んだため、両方とも経路の設定を取れずに接続が切れた。
    > Gateway instances restarting during the update process were marked healthy before their configuration and routing state had been fully restored.

    報告が挙げた対策:
    > We are strengthening ExpressRoute gateway health checks, to ensure that redundant instances are updated only after the initial instances have fully restored its configuration and routing state.
- 今とれる対策:
  - readiness 用のチェックは、Redis（または Spanner・AlloyDB）への接続が一度成功するまで NotServing を返すようにし、ローリング更新はそれを待って進める。liveness は今のまま依存先を見ない形を保つ（「対策済みだった箇所」を参照）（最初の一歩: `RedisCartStore.cs` の `Ping()` で Redis に実際に問い合わせ、`kubernetes-manifests/cartservice.yaml` の readinessProbe には `grpc.service` で readiness 用のサービス名を指定して、liveness とは別に判定する）

### 4. 【中】productcatalogservice のカタログ読み込みが全リクエストで1つのロックを取り合い、負荷試験は10ユーザーなので見つからない

- 重要度の理由: 影響の広さ A（商品一覧はトップ・商品・カート・チェックアウトのすべてで使われる）／条件のそろいやすさ 3（SIGUSR1 で再読み込みを有効にする操作と、本番並みの負荷が重なったときだけ起きる）
- 根拠:
  - `src/productcatalogservice/product_catalog.go:74-83` — `reloadCatalog` が真のときは、リクエストのたびに `loadCatalog` を呼ぶ

    ```go
    func (p *productCatalog) parseCatalog() []*pb.Product {
    	if reloadCatalog || len(p.catalog.Products) == 0 {
    		err := loadCatalog(&p.catalog)
    ```
  - `src/productcatalogservice/catalog_loader.go:33-35` — `loadCatalog` は全体で1つの `catalogMutex` を取ったまま、ファイルを読んで JSON を解析する。AlloyDB を使う構成では、ロックを持ったまま Secret Manager の呼び出しと AlloyDB への接続・クエリまで行う（`catalog_loader.go:96-133`）
  - `src/productcatalogservice/server.go:99-113` — SIGUSR1 を受けると `reloadCatalog = true` になる
  - `kubernetes-manifests/loadgenerator.yaml:84-87` と `.github/workflows/ci-main.yaml:142-150` — 負荷は `USERS: "10"`・`RATE: "1"` で、CI の確認は50リクエストのエラー数だけを見ている
- 同じ起き方をした障害:
  - [Microsoft 365 のネットワークゲートウェイが世界的に応答しなくなった障害](https://www.365fanatic.com/wp-content/uploads/2026/11/postincidentreport.pdf)（2026-11-12、Microsoft）: 7月から展開した修正が、特定の負荷の条件でロック競合を起こし、サーバーの CPU とメモリを使い切らせた。3か月以上問題は出ていなかった。
    > Our normal load testing did not detect the latent issue because the traffic mix and SKUs used in our labs.

    報告が挙げた対策:
    > Developed an update that returned the connection handling code path to the previously known good state
- 今とれる対策:
  - 再読み込みは、リクエストの処理から外して定期実行の goroutine に移し、読み込みが終わってから参照を差し替える形にする。リクエストの処理でロックを取らない。そのうえで、本番のピークを超える流量で loadgenerator を回して確かめる（最初の一歩: `product_catalog.go` の `parseCatalog` から `loadCatalog` の呼び出しを外し、`server.go` の SIGUSR1 のハンドラで一度だけ読み込むように変え、`USERS` を上げた loadgenerator で p99 を比べる）

## 対策済みだった箇所

- ヘルスチェックが依存先への接続に依存し、再起動が連鎖する（Azure OpenAI Service の障害）: `src/cartservice/src/cartstore/RedisCartStore.cs:106-116` — livenessProbe が叩くヘルスチェックは Redis への接続を見ないので、Redis が不調になっても cartservice が再起動を繰り返すことはない。redis-cart 自身の liveness も `tcpSocket`（`kubernetes-manifests/cartservice.yaml:125-128`）だけを見ている。ただし同じ箇所が、弱い箇所3（readiness が何も確かめない）の原因になっている
- 値のない絞り込みが、全件に当たる（Cloudflare BYOIP の障害）: `.github/workflows/cleanup.yaml:54-66` — 削除の対象を `^pr[0-9]+$` の名前空間に絞り、対象が空なら終える。PR の状態が取れずに空になったときも、`CLOSED`・`MERGED` に一致しないので消さない

## 当てはまらなかった弱い箇所

- フェイルオーバーで、別のサービスと共有している入口に負荷が寄る（Microsoft 365 の障害）: 外向きの入口は frontend 専用の `frontend-external`（`kubernetes-manifests/frontend.yaml:124-136`）か、frontend 専用の Ingress だけで、待機系へのフェイルオーバーの設定もない
- 正常なサーバーへの自動の振り分けが、連鎖を広げる（Microsoft 365 の障害）: どの Deployment も既定で1台なので、ほかのサーバーへ負荷を寄せる振り分けが起きない
- リージョン間の隔壁が効かない（Microsoft 365 の障害）: 載せる先は1つのクラスタ（`terraform/main.tf:40-59`）で、リージョンをまたいで振り分ける設定がない
- 戻したサーバーが、溜まった要求で再び倒れる（Microsoft 365 の障害）: `src/` 配下とメッシュの設定を Grep しても再送の設定がなく、止まっている間の要求が溜まって押し寄せる作りがない
- 止めていた展開が、再開のときに一斉に流れる（Azure ネットワークの障害）: デプロイを止めたり凍結したりする仕組みが、ワークフローにも手順書にもない
- 共有のコントロールプレーンに、急増を断る仕組みがない（Azure ネットワークの障害）: 各サービスは環境変数から設定を読む作りで、起動時に共有の設定サービスへ取りに行かない
- デプロイでキャッシュが消え、バックエンドに要求が押し寄せる（Azure OpenAI Service の障害）: プロセスの中のカタログは起動時に一度だけ読み込む（`src/productcatalogservice/server.go:138-141`）ので、再起動で外れた要求がバックエンドへ押し寄せる作りがない
- クライアントの再送が、負荷をさらに押し上げる（Azure OpenAI Service の障害）: gRPC クライアントは `grpc.NewClient` を既定の設定で使っていて（`src/frontend/main.go:229-231`）、再送の方針を設定していない
- 速すぎる・広すぎる変更を止める仕組みがない（Cloudflare BYOIP の障害）: 本番のデータを変える自動処理がない。定期ジョブは CI の PR 用クラスタの名前空間を消すものだけ
- 人の操作を通さずに動く処理を、テストしていない（Cloudflare BYOIP の障害）: 利用者のデータを変える定期実行のジョブやワーカーがない
- 壊れたデータを、すぐに前の状態へ戻せない（Cloudflare BYOIP の障害）: 利用者のデータをまとめて消したり書き換えたりする自動処理がない
- 復旧のあとも、溜まった処理の消化に時間がかかる（Google Cloud us-west1 の障害）: キューもイベント駆動のワーカーもない
- 振り分けの設定変更が、容量を考えた振り分けを迂回する（Google Cloud Storage の障害）: 重み・アフィニティ・コンシステントハッシュを使う振り分けの設定がない（Istio のマニフェストと `.github/release-cluster/` を Grep して確認した）

## このリポジトリでは判断できなかった弱い箇所

- 負荷試験の機種が本番と違う（Microsoft 365 の障害）: CI の PR 用クラスタは Autopilot（`.github/terraform/main.tf:98-101`）だが、公開している release クラスタの定義がこのリポジトリにないので、機種を比べられない
- 数か月前の変更を、すぐに戻せない（Microsoft 365 の障害）: 本番での展開とロールバックの運用は、このリポジトリの外で決まる
- 共有サービスの処理時間を延ばす、以前の変更（Azure ネットワークの障害）: メトリクスとダッシュボードの定義がこのリポジトリにない（frontend の `initStats` は TODO のまま。`src/frontend/main.go:173-175`）。Cloud Operations の側で計測しているかは確かめられない
- 接続の枯渇が、監視の値に表れない（Azure OpenAI Service の障害）: 上と同じ理由で、接続プールの計測とアラートがあるかを確かめられない
- 戻しが不完全で、同じ障害が再発する（Google Cloud Storage の障害）: Kustomize の component を入れたり外したりする作業は利用者が行うもので、戻す手順があるかはこのリポジトリでは決まらない

## ストックの外で気づいたこと

- カートのデータが Pod の一時領域にしかない: redis-cart は `emptyDir` に書いていて、レプリカも永続化もない（`kubernetes-manifests/cartservice.yaml:139-141`）。弱い箇所1のノード保守で Pod が追い出されると、全利用者のカートの中身が消える
- AlloyDB 構成の productcatalogservice は、カタログを読み込むたびに Secret Manager のクライアントと AlloyDB の接続プールを作り直して閉じている（`src/productcatalogservice/catalog_loader.go:62-69`・`:101-130`）。弱い箇所4の再読み込みが有効なときは、これがリクエストごとに走る

---

結果をファイルに保存したいときは、言っていただければ保存します。
