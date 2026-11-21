# 実行例: GoogleCloudPlatform/microservices-demo

公開されている OSS（[GoogleCloudPlatform/microservices-demo](https://github.com/GoogleCloudPlatform/microservices-demo)、コミット `c7cb6d5`）で `/postmortem-lens:check` を実行した結果（2026-11-21、障害6件のストック）。出力をそのまま載せている。

---

# postmortem-lens の検査結果: microservices-demo（Online Boutique）

- 検査したもの: 11個のマイクロサービスが gRPC で呼び合う、Google のデモ用 EC アプリ。Kubernetes のマニフェスト・Helm・Kustomize・Terraform（GKE Autopilot）・GitHub Actions を含む
- 照らしたストック: 6件の障害・25個の弱い箇所（2026-02-20〜2026-11-12）
- 結果: 当てはまる 10・対策済み 3・判断できない 12

## 弱い箇所（重要な順）

### 1. 【高】全サービスが1台で、PodDisruptionBudget もなく、カートの Redis は emptyDir に置いている

- 重要度の理由: 影響の広さ A（frontend が1台なので、その Pod が止まるとサイト全体が止まる。redis-cart のデータは emptyDir にあるので、Pod を作り直すと全利用者のカートが消える）／条件のそろいやすさ 1（GKE Autopilot のノードの自動更新や、Pod の再配置といった日常の動きで起きる）
- 根拠:
  - `kubernetes-manifests/frontend.yaml:21-24` — `replicas` を書いていないので1台になる。リポジトリ全体を Grep しても、`replicas` を書いているのは loadgenerator と otel-collector の2つだけで、どちらも `replicas: 1`。`PodDisruptionBudget`・`HorizontalPodAutoscaler`・`topologySpread` は1件もない

    ```yaml
    spec:
      selector:
        matchLabels:
          app: frontend
    ```

  - `kubernetes-manifests/cartservice.yaml:139-141` — カートのデータを置く Redis の保存先が emptyDir になっている

    ```yaml
          volumes:
          - name: redis-data
            emptyDir: {}
    ```

  - `terraform/main.tf:40-46` — クラスタは Autopilot で、ノードの入れ替えは GKE が行う

    ```hcl
    resource "google_container_cluster" "my_cluster" {
      name     = var.name
      location = var.region
      # Enable autopilot for this cluster
      enable_autopilot = true
    ```

- 同じ起き方をした障害:
  - [光ファイバーの保守で、Google Cloud の us-west1 の多くのサービスが劣化した障害](https://status.cloud.google.com/incidents/utF3FMFdQfwBzJcGG6vf)（2026-08-20、Google）: 予定していた光ファイバーの保守が、データセンター間の通信容量を想定外に減らし、自動の迂回も別の容量へうまく振り分けられなかった。
    > The disruption originated during scheduled fiber optic maintenance, which unexpectedly compromised network capacity between data centers within the us-west1 region.
  - [止めていた更新が一斉に再開し、Azure のネットワークのコントロールプレーンがあふれた障害](https://azure.status.microsoft/en-us/status/history/)（2026-09-30、Microsoft）: 一時的な展開の制限が期限切れになると、止まっていた多くのゲートウェイの更新が短い時間に再開し、再起動と設定の取得の要求が急増した。
    > When this restriction expired, a large number of gateway updates resumed within a short period, generating a surge in gateway restarts and configuration-retrieval requests.
- 今とれる対策:
  - frontend・cartservice・currencyservice・productcatalogservice を2台以上にし、`minAvailable: 1` の PodDisruptionBudget を付けて、ノードの保守で残る台数が0にならないようにする（最初の一歩: `kustomize/components/` に、`replicas: 2` のパッチと PodDisruptionBudget を入れたコンポーネントを足し、`kustomize/kustomization.yaml` から読み込む）
  - カートを消したくない環境では、Memorystore（`kustomize/components/memorystore`）か Spanner・AlloyDB のコンポーネントを使い、emptyDir の redis-cart を使わない（最初の一歩: `kustomize/components/memorystore/README.md` の手順で、Redis の置き場所を外に出す）

### 2. 【高】frontend から後ろのサービスへの呼び出しにタイムアウトがなく、トップページが3つのサービスすべてに依存している

- 重要度の理由: 影響の広さ A（トップページは currency・productcatalog・cart のどれか1つが失敗すると 500 を返し、商品ごとに通貨の変換を順番に呼ぶ。期限を付けていないので、後ろのサービスが遅くなると frontend の要求が溜まり続ける）／条件のそろいやすさ 2（後ろのサービスが1つ遅くなるだけで起きる）
- 根拠:
  - `src/frontend/rpc.go:57-60` — 要求の context をそのまま渡していて、期限を付けていない。期限を付けているのは `getAd`（`rpc.go:120`、100ms）だけ

    ```go
    func (fe *frontendServer) getCart(ctx context.Context, userID string) ([]*pb.CartItem, error) {
    	resp, err := pb.NewCartServiceClient(fe.cartSvcConn).GetCart(ctx, &pb.GetCartRequest{UserId: userID})
    	return resp.GetItems(), err
    }
    ```

  - `src/frontend/handlers.go:72-76` と `:83-88` — cart が失敗するとトップページ全体が 500 になる。通貨の変換は商品ごとに順番に呼ぶ

    ```go
    	cart, err := fe.getCart(r.Context(), sessionID(r))
    	if err != nil {
    		renderHTTPError(log, r, w, errors.Wrap(err, "could not retrieve cart"), http.StatusInternalServerError)
    		return
    	}
    ```

  - `src/frontend/main.go:171` — HTTP サーバーを `http.ListenAndServe` で起動しているので、読み書きのタイムアウトがない

    ```go
    	log.Fatal(http.ListenAndServe(addr+":"+srvPort, handler))
    ```

  - `src/checkoutservice/main.go:324-325` — checkoutservice から cart・productcatalog・shipping・currency を呼ぶときも、期限を付けていない
- 同じ起き方をした障害:
  - [光ファイバーの保守で、Google Cloud の us-west1 の多くのサービスが劣化した障害](https://status.cloud.google.com/incidents/utF3FMFdQfwBzJcGG6vf)（2026-08-20、Google）: 通信の劣化で Spanner などの基盤サービスの遅れが急増し、それに依存する Cloud Storage・IAM・Persistent Disk・GKE がタイムアウトとエラーを出した。
    > Core infrastructure services, including Spanner Paxos consensus and the Unified Metadata Server (UMS), experienced significant latency spikes, which cascaded into timeouts and elevated error rates for downstream dependent products such as Cloud Storage, Cloud IAM, Persistent Disk, and Google Kubernetes Engine.
  - [キャッシュの消去とヘルスチェックの作りで、Azure OpenAI Service が再起動を繰り返した障害](https://azure.status.microsoft/en-us/status/history/)（2026-09-29、Microsoft）: 応答の遅れで接続が長く保たれ、クライアントの再送が要求を増やして、接続の容量を使い切った。
    > This higher latency caused connections to be held open longer, while client retries added further requests.
- 今とれる対策:
  - 後ろのサービスを呼ぶ処理すべてに `context.WithTimeout` で期限を付け、cart が失敗したときは空のカートとして表示を続ける（最初の一歩: `src/frontend/rpc.go` の各関数に、`getAd` と同じ形で期限を付け、`handlers.go:72-76` の cart の失敗を警告のログに変える）
  - HTTP サーバーを `http.Server{ReadHeaderTimeout, ReadTimeout, WriteTimeout}` で起動する（最初の一歩: `src/frontend/main.go:171` を書き換える）
  - 補足: gRPC クライアントに再送の設定はないので、再送で負荷が膨らむ心配は今のところない。再送を入れるときは、指数バックオフと回数の上限を付ける

### 3. 【高】cartservice のヘルスチェックが Redis を確かめずに「正常」を返し、ローリング更新が先へ進む

- 重要度の理由: 影響の広さ A（cart が失敗するとトップページも 500 になるので（弱い箇所 2）、Redis につながらない新しい Pod に切り替わるとサイト全体が使えなくなる）／条件のそろいやすさ 2（`REDIS_ADDR` の書き間違いのような、設定の誤りが1つあれば起きる。Memorystore のコンポーネントは `REDIS_CONNECTION_STRING` という仮の値を書き換える前提になっている）
- 根拠:
  - `src/cartservice/src/cartstore/RedisCartStore.cs:106-116` — `Ping()` が Redis に問い合わせず、常に true を返す

    ```csharp
            public bool Ping()
            {
                try
                {
                    return true;
                }
    ```

  - `src/cartservice/src/services/HealthCheckService.cs:36-38` — その `Ping()` の結果を、そのまま gRPC のヘルスチェックの答えにしている
  - `kubernetes-manifests/cartservice.yaml:59-67` — readinessProbe と livenessProbe が同じ gRPC のヘルスチェックを叩いている
  - `kustomize/components/memorystore/kustomization.yaml:30-31` — 書き換え前の仮の値のまま適用すると、つながらない Redis を指す

    ```yaml
                  - name: REDIS_ADDR
                    value: "REDIS_CONNECTION_STRING"
    ```

- 同じ起き方をした障害:
  - [止めていた更新が一斉に再開し、Azure のネットワークのコントロールプレーンがあふれた障害](https://azure.status.microsoft/en-us/status/history/)（2026-09-30、Microsoft）: 再起動したゲートウェイが、設定と経路の情報を戻しきる前に正常と判定され、冗長化した相方の更新が先に進んだため、両方とも経路の設定を取れずに接続が切れた。
    > Gateway instances restarting during the update process were marked healthy before their configuration and routing state had been fully restored.
- 今とれる対策:
  - readiness 用のヘルスチェックでは Redis に PING を送って確かめ、liveness はプロセスが動いているかだけを見るように分ける。こうすれば、Redis が落ちたときに再起動が連鎖することもない（下の「対策済み」を参照）（最初の一歩: `RedisCartStore.Ping()` で `IConnectionMultiplexer` を使って PING を送り、`kubernetes-manifests/cartservice.yaml` の readinessProbe だけに gRPC の `service` 名を付けて、liveness と別の答えを返せるようにする）

### 4. 【高】productcatalogservice（AlloyDB を使う構成）が、カタログを取れないと起動に失敗し、読み直しに失敗すると空のカタログを返す

- 重要度の理由: 影響の広さ A（カタログを返せないとトップページが 500 になり、商品も表示されない）／条件のそろいやすさ 2（AlloyDB か Secret Manager の不調が、Pod の再起動と重なるだけで起きる）。ただし、当てはまるのは `kustomize/components/alloydb` を使う構成だけで、標準の構成はイメージに入れた `products.json` を読む
- 根拠:
  - `src/productcatalogservice/server.go:138-141` — 起動時にカタログを読めないと `log.Fatalf` でプロセスを止める。手元に保存した前回のカタログはない

    ```go
    	err = loadCatalog(&svc.catalog)
    	if err != nil {
    		log.Fatalf("could not parse product catalog: %v", err)
    	}
    ```

  - `src/productcatalogservice/product_catalog.go:74-79` — 読み直しに失敗すると、メモリに残っているカタログがあっても空の一覧を返す

    ```go
    func (p *productCatalog) parseCatalog() []*pb.Product {
    	if reloadCatalog || len(p.catalog.Products) == 0 {
    		err := loadCatalog(&p.catalog)
    		if err != nil {
    			return []*pb.Product{}
    		}
    ```

  - `src/productcatalogservice/catalog_loader.go:140` — 行を読み終える前にカタログを空にしているので、途中で失敗すると前のカタログが消える

    ```go
    	catalog.Products = catalog.Products[:0]
    ```

- 同じ起き方をした障害:
  - [止めていた更新が一斉に再開し、Azure のネットワークのコントロールプレーンがあふれた障害](https://azure.status.microsoft/en-us/status/history/)（2026-09-30、Microsoft）: 経路の設定を取れなかったゲートウェイは、約30分試したあとで、手元に保存していた最後に正しかった設定（LKG）を使って自動で接続を戻した。
    > After approximately 30 minutes of unsuccessful configuration-retrieval attempts, the affected gateways automatically applied their locally stored last known good (LKG) configurations and restored connectivity.
- 今とれる対策:
  - 読み込みは一時的な変数に対して行い、成功したときだけ差し替える。失敗したときは前のカタログを返し続け、起動時に AlloyDB から取れないときは同梱の `products.json` で起動する（最初の一歩: `catalog_loader.go` の `loadCatalogFromAlloyDB` を、新しい `ListProductsResponse` に読み込んでから差し替える形にし、`product_catalog.go:78` を `return p.catalog.Products` に変える）

### 5. 【中】接続や後ろのサービスへの呼び出しを計測しておらず、詰まりが監視の値に表れない

- 重要度の理由: 影響の広さ B（それだけでは止まらないが、弱い箇所 2 から 4 で止まったときに、原因の特定が遅れて止まる時間が延びる）／条件のそろいやすさ 2（後ろのサービスの不調が1つ起きたときに効いてくる）
- 根拠:
  - `src/frontend/main.go:173-175` — メトリクスを出す処理が未実装のままになっている。同じ TODO が `src/checkoutservice/main.go:150-151`・`src/productcatalogservice/server.go:151-152`・`src/shippingservice/main.go:155-156`・`src/adservice/src/main/java/hipstershop/AdService.java:205` にもある

    ```go
    func initStats(log logrus.FieldLogger) {
    	// TODO(arbrown) Implement OpenTelemtry stats
    }
    ```

  - `kustomize/components/google-cloud-operations/otel-collector.yaml:123-126` — コレクター側には metrics の経路があるが、上のとおりアプリが何も送っていない
- 同じ起き方をした障害:
  - [キャッシュの消去とヘルスチェックの作りで、Azure OpenAI Service が再起動を繰り返した障害](https://azure.status.microsoft/en-us/status/history/)（2026-09-29、Microsoft）: 既存のネットワークと診断の値では接続の枯渇が分からず、原因と結びつけるのに時間がかかったため、台数やリソースを増やす対処が効かないまま続いた。
    > Existing network metrics and diagnostic metrics did not effectively indicate the connection exhaustion issue in this scenario.
- 今とれる対策:
  - 後ろのサービスごとに、呼び出しの遅れ・失敗（`DeadlineExceeded`・`Unavailable` を分けて）と、Redis・AlloyDB の接続プールの使用数を計測し、アラートの条件にする（最初の一歩: `src/frontend/main.go` の `initStats` で OTel の MeterProvider を作る。`otelgrpc.NewClientHandler()` はすでに付いているので、MeterProvider を設定すれば gRPC クライアントのメトリクスも出せる）

### 6. 【低】カタログを読み直すとき、グローバルなロックの下で要求ごとに全件を読み直し、負荷試験はそれを表に出せない流量しか流していない

- 重要度の理由: 影響の広さ C（遅くなる。`src/productcatalogservice/README.md:9-16` に、わざと不完全に作った機能だと書かれている）／条件のそろいやすさ 2（SIGUSR1 で読み直しを有効にしたときに起きる。AlloyDB の構成では、Secret Manager のクライアント・ダイヤラー・接続プールを要求のたびに作るため、さらに重くなる）
- 根拠:
  - `src/productcatalogservice/catalog_loader.go:33-35` — カタログの読み込み全体を、1つのグローバルな mutex の下で行う

    ```go
    func loadCatalog(catalog *pb.ListProductsResponse) error {
    	catalogMutex.Lock()
    	defer catalogMutex.Unlock()
    ```

  - `kubernetes-manifests/loadgenerator.yaml:84-87` — 負荷試験の流量は 10ユーザー・RATE 1 に固定されている

    ```yaml
            - name: USERS
              value: "10"
            - name: RATE
              value: "1"
    ```

  - `.github/workflows/ci-main.yaml:141-145` — CI では、50件の要求が流れたところで確認を終える
- 同じ起き方をした障害:
  - [Microsoft 365 のネットワークゲートウェイが世界的に応答しなくなった障害](https://www.365fanatic.com/wp-content/uploads/2026/11/postincidentreport.pdf)（2026-11-12、Microsoft）: 7月から展開した修正が、特定の負荷の条件でロック競合を起こし、サーバーの CPU とメモリを使い切らせた。3か月以上問題は出ていなかった。
    > First, a latent defect caused Windows servers to become overwhelmed and unresponsive under certain load conditions.
- 今とれる対策:
  - 入口に近いサービスを変えたときは、本番のピークを上回る流量で loadgenerator を流す手順を、リリースの前に入れる（最初の一歩: `docs/releasing/README.md` に、`USERS` と `RATE` を本番のピーク以上にして loadgenerator を一定時間流す手順を書き足す）

### 7. 【低】1時間ごとの後片付けのジョブに、一度に消す件数の上限とテストがない

- 重要度の理由: 影響の広さ C（消えるのはステージングのクラスタにある PR 用の名前空間だけで、デプロイし直せば作り直せる）／条件のそろいやすさ 3（`gh pr view` が誤った状態を返すことと、名前空間の命名が崩れることが重ならないと、消すべきでないものは消えない）
- 根拠:
  - `.github/workflows/cleanup.yaml:60-67` — 一致した名前空間を、件数を確かめずに順に消す。止めるにはワークフローを無効にするしかない

    ```bash
              for NAMESPACE in $NAMESPACES; do
                PR_NUMBER="${NAMESPACE#pr}"
                STATE=$(gh pr view "$PR_NUMBER" --repo "${{ github.repository }}" --json state --jq '.state' || true)
                ...
                  kubectl delete namespace "$NAMESPACE" --ignore-not-found
    ```

  - `.github/workflows/cleanup.yaml:17-19` — 直近のコミット（c7cb6d5）で、1時間ごとの定期実行に変わった。リポジトリに、このスクリプトのテストはない
- 同じ起き方をした障害:
  - [後片付けの自動処理が、Cloudflare の BYOIP の経路を消した障害](https://blog.cloudflare.com/cloudflare-outage-february-20-2026/)（2026-02-20、Cloudflare）: 自動処理が経路を次々に消していくのを止める仕組みがなく、影響に気づいた人が処理を止めるまで削除が続いた。
    > This will form a type of circuit breaker to stop any out-of-control process that is manipulating the database from having a large blast radius, like we saw in this incident.
  - 同じ障害で: テストは顧客が API を操作する流れを確かめていたが、裏で動く処理が人の入力なしに利用者のデータを変える場合を確かめていなかった。
    > While our engineers successfully tested the exact process a customer would have followed, testing did not cover a scenario where the task-runner service would independently execute changes to user data without explicit input.
- 今とれる対策:
  - 1回の実行で消す件数に上限（たとえば10件）を設け、超えたら消さずに失敗させる。止めるためのスイッチとして、リポジトリ変数（`vars.CLEANUP_ENABLED`）を見る（最初の一歩: `cleanup.yaml:60` の前で、消す候補の件数を数えて上限と比べる処理を足す）

## 対策済みだった箇所

- 削除の対象を選ぶ条件が空のときに全件に当たる問題: `.github/workflows/cleanup.yaml:54-58`・`:62-64` — 名前空間を `^pr[0-9]+$` で厳密に絞り、候補が空なら何もせず終わる。PR の状態を取れないときは `STATE` が空になって消さない。消すのは `CLOSED` か `MERGED` と明示されたものだけ
- ヘルスチェックが依存先に依存して再起動が連鎖する問題: `src/cartservice/src/cartstore/RedisCartStore.cs:106-116`・`src/checkoutservice/main.go:222-224` — liveness が叩くヘルスチェックは Redis や後ろのサービスを確かめないので、依存先の不調で再起動は連鎖しない（その代わりに弱い箇所 3 が生じている）
- デプロイでメモリ上のキャッシュが消え、後ろへ要求が押し寄せる問題: `src/productcatalogservice/server.go:138-146` — カタログを読み終えてから `srv.Serve` を始めるので、空の状態で要求を受けない（読み直しの機能は弱い箇所 6 を参照）

## このリポジトリでは判断できなかった弱い箇所

- 負荷試験の機種が本番と違う（Microsoft 365 のネットワークゲートウェイの障害）: 本番環境の定義がない。loadgenerator はアプリと同じクラスタで動き、Autopilot は機種を書いていない
- フェイルオーバーで、別のサービスと共有している入口に負荷が寄る（Microsoft 365 のネットワークゲートウェイの障害）: 入口は frontend 専用の LoadBalancer（`kubernetes-manifests/frontend.yaml:124-136`）だけで、フェイルオーバーの設定がない
- 正常なサーバーへの自動の振り分けが、連鎖を広げる（Microsoft 365 のネットワークゲートウェイの障害）: 各サービスが1台なので、残った台数に負荷が集まる構成になっていない（1台であること自体の弱さは弱い箇所 1）
- リージョン間の隔壁が効かない（Microsoft 365 のネットワークゲートウェイの障害）: リージョンもクラスタも1つだけで、リージョンをまたぐ振り分けがない
- 戻したサーバーが、溜まった要求で再び倒れる（Microsoft 365 のネットワークゲートウェイの障害）: gRPC クライアントは再送をせず、戻す先も1台なので、溜まった要求が押し寄せる構成になっていない
- 数か月前の変更を、すぐに戻せない（Microsoft 365 のネットワークゲートウェイの障害）: 機能フラグとロールバックの手順が、このリポジトリにない
- 共有のコントロールプレーンに、急増を断る仕組みがない（Azure のネットワークのコントロールプレーンの障害）: 多数のインスタンスが起動時に同じ設定サービスへ一斉に取りに行く構成がない
- 壊れたデータを、すぐに前の状態へ戻せない（Cloudflare の BYOIP の障害）: 利用者のデータをまとめて消す処理がない。後片付けが消すのは、デプロイし直せば作り直せる PR 環境だけ
- 復旧のあとも、溜まった処理の消化に時間がかかる（Google Cloud の us-west1 の障害）: キューとワーカーがない
- 振り分けの設定変更が、容量を考えた振り分けを迂回する（Google Cloud Storage の障害）: 重みやアフィニティで振り分ける設定がない。Helm の DestinationRule（`helm-chart/templates/cartservice.yaml:372-384`）は TLS の設定だけ
- 振り分けの変更を、利用の少ない環境で先に試さない（Google Cloud Storage の障害）: 本番へ展開する CD の定義がなく、CI がデプロイするのは PR 用のステージングのクラスタだけ
- 戻しが不完全で、同じ障害が再発する（Google Cloud Storage の障害）: 依存し合う機能フラグやマイグレーションがない

補足: スキルの決まりは「コマンドを実行しない」ですが、最初にファイルの一覧を見るため、読むだけの `git ls-files` を1回実行しました。そのあとはファイルを読むツールだけで調べ、ファイルの書き換えも外部への送信もしていません。

この結果をファイルに保存したいときは、そう頼んでください。
