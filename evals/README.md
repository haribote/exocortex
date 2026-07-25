# @exocortex/evals

`REVIEW_MODEL` を差し替えたときのレビュー品質を、再現可能な形で比較するための eval harness です。

## 何を測るか

本番の `POST /review` を HTTP 越しに叩いて測ります。
Ollama を直接叩いたり、プロンプトを組み直したりはしません。
比較したいのはモデル単体の賢さではなく、prompt と context packing と quote 検証を通した後にユーザーが受け取るレビューの質だからです。

case ごとに、バグを仕込んだ小さな TypeScript リポジトリを一時ディレクトリに組み立て、その snapshot を送ります。
仕込んだバグの位置は `case.json` の `anchor`（head ファイル中に一意に現れる 1 行）で示します。
行番号は実行時に anchor から解決するため、fixture を編集しても行番号がずれません。

## セットアップ

リポジトリのルートで依存を入れ、`@exocortex/contract` をビルドします。

```bash
pnpm install
pnpm -r build
```

`evals` 自体のビルドは要りません。
Node 24 の型ストリッピングで `.ts` をそのまま実行します。

## 単体テスト

fixture と採点ロジックのテストは、推論サーバーも GPU も要りません。

```bash
pnpm --filter @exocortex/evals test
```

このテストが守っているのは次の 3 点です。

- **anchor の一意性**：全 case の全 anchor が、対応するファイルにちょうど 1 回だけ現れる
- **fixture の隔離**：`createFixture` は `mkdtemp` 配下にしかリポジトリを作らず、case のソースディレクトリを書き換えない
- **diff の内容**：`base` / `worktree` / `staged` の 3 モードそれぞれで、サーバーが集める diff に仕込んだ行が現れる
- **切り替えコマンドの安全性**：`<|think|>` のような shell metacharacter を含む値が、リモートに literal のまま届く
- **既定でリモートを触らないこと**：`--switch` が無ければ config は単なるラベルに解決される

## 計測の実行

計測にはレビューサーバーが要ります。
ディストロを起こし、SSH トンネルを張ってから実行します。

```bash
ssh exocortex "wsl -d exocortex -- /bin/true"
pkill -f "11435:127.0.0.1:11435"
ssh -f -N -o ExitOnForwardFailure=yes -L 11435:127.0.0.1:11435 exocortex
```

既定では、harness はサーバーを一切触りません。
比較したいモデルはサーバー側の環境変数で決まるため、自分で切り替えてから測ります。
サーバーで `REVIEW_MODEL` を設定してコンテナを再起動し、そのモデル名を `--configs` に渡します。

```bash
cd evals
node src/run.ts --run 2026-07 --configs qwen3:14b --repeats 3
```

サーバーが報告した `meta.model` が `--configs` の値と食い違うと警告が出ます。
再起動を忘れたまま測ってしまう事故は、これで気付けます。

モデルを入れ替えたら、同じ `--run` で次の config を測ります。
結果は同じ `results.ndjson` に追記されます。

```bash
node src/run.ts --run 2026-07 --configs qwen2.5-coder:14b --repeats 3
```

オプションは次のとおりです。

- `--run <id>`：出力先を `runs/<id>/` に決めます（既定 `default`）
- `--configs <a,b>`：計測する config。`--switch` の有無で意味が変わります（下記）
- `--cases <a,b>`：case を絞ります（既定は全件）
- `--repeats <n>`：同じ組み合わせを何回測るか（既定 1）
- `--endpoint <url>`：レビューサーバーの URL（既定 `http://localhost:11435`）
- `--timeout <ms>`：1 リクエストの上限（既定 600000）
- `--switch`：config ごとにサーバーを切り替えます（下記）
- `--health-timeout <ms>`：切り替え後に `/health` を待つ上限（既定 180000）

## 無人実行のための自動切り替え

6 config を 1 つずつ手で切り替えるのは、一晩の無人実行には向きません。
`--switch` を付けると、harness が config ごとにサーバーを再作成してから測ります。

```bash
node src/run.ts --run 2026-07 --switch --repeats 3
```

**`--switch` を付けたときだけ、harness はリモートを触ります。**
付けなければ従来どおり、config は単なるラベルで、モデル不一致は警告に留まります。
事故で本番サービスを再起動しないための切り分けです。
`EXOCORTEX_SWITCH=1` でも有効にできます。

`--switch` を付けると、`--configs` の意味がラベルから `configs.json` の id に変わります。
`--configs` を省略すると `configs.json` の全 config を順に measure します。

### configs.json

計測する config は `configs.json` に定義します。
`id` と、サーバーに設定する環境変数の組です。

```json
[
  { "id": "C0", "env": { "REVIEW_MODEL": "qwen3:14b" } },
  {
    "id": "C2",
    "env": { "REVIEW_MODEL": "gemma4:12b", "REVIEW_THINK": "false" }
  }
]
```

現在の 6 config は次のとおりです。

| id | REVIEW_MODEL | 設定 |
| --- | --- | --- |
| C0 | `qwen3:14b` | なし。thinking 有効で、現行の本番構成そのものです |
| C0p | `qwen3:14b` | `REVIEW_SYSTEM_MODE=prefix` |
| C1 | `gemma4:12b` | なし。thinking 有効です |
| C2 | `gemma4:12b` | `REVIEW_THINK=false` |
| C3 | `qwen3.5:9b` | なし |
| C4 | `gpt-oss:20b` | `REVIEW_THINK=high` |

thinking の有無の対照は `REVIEW_THINK` で作ります。
`gemma4:12b` は `think` 未指定と `think: true` が完全に同一の結果になり、thinking は既定で有効だと実測で分かったためです。
`think: false` は 3 モデルすべてで thinking を確実に止めます。

`env` に書いた変数だけがサーバーに渡ります。
ある config で指定しなかった変数は、compose ファイルの既定値に戻ります。
つまり各 config は差分ではなく、環境の完全な指定です。

### 接続先の環境変数

接続先はハードコードしていません。
既定値は次のとおりで、いずれも環境変数で上書きできます。

- `EXOCORTEX_SSH_HOST`：ssh の host（既定 `exocortex`）
- `EXOCORTEX_WSL_DISTRO`：WSL のディストロ名（既定 `exocortex`）
- `EXOCORTEX_COMPOSE_DIR`：compose ファイルのあるディレクトリ（既定 `/home/haribote/exocortex`）
- `EXOCORTEX_API_SERVICE`：再作成する compose サービス名（既定 `ai-api`）

`ollama` サービスは再作成しません。
`OLLAMA_MAX_LOADED_MODELS=1` が新しいモデルへの入れ替えを行います。

### 切り替えの手順

各 config のバッチに入る前に、harness は次を順に行います。

1. ssh 経由で `ai-api` を新しい環境変数で再作成する
2. `/health` が `{"status":"ok"}` を返すまで待つ
3. warm-up リクエストを 1 件投げて、その結果を捨てる
4. `meta.model` が config の `REVIEW_MODEL` と一致することを確認する
5. `ollama ps` を取得して `environment.md` に追記する

warm-up の結果を捨てるのは、切り替え後の最初の 1 件がモデルのロード時間を含むからです。
これを記録に混ぜると、その config だけレイテンシが実態より悪く出ます。

`meta.model` が食い違ったときは、**その config を中断して次へ進みます**。
ラベルと中身が食い違ったデータを記録しないためです。
中断した事実は `environment.md` に残り、終了コードは 1 になります。
ssh が失敗したときと `/health` が返らなかったときも同じ扱いです。

`environment.md` には config ごとに `ollama ps` の出力が残ります。
`100% GPU` でない config は、重みの一部が CPU に落ちています。
その場合はレイテンシ比較から除外する必要があるため、`environment.md` にその旨を書き添えます。

## 途中で落ちたとき

結果は 1 件測るごとに `runs/<id>/results.ndjson` へ追記されます。
同じ `--run` で再実行すると、記録済みの `(config, case, repeat)` を読み飛ばして続きから再開します。

SSH トンネルが切れたり WSL の VM が idle で落ちたりして接続自体が失敗した場合、その 1 件は記録せずに実行を打ち切ります。
トンネルを張り直して同じコマンドを再実行してください。

サーバーが 502 や 504 を返した場合は、計測結果として記録します。
生のレスポンス body も残るため、後から原因を追えます。

## レポートの生成

```bash
node src/report.ts --run 2026-07
```

`runs/<id>/` に 3 つのファイルが出ます。

- `summary.md`：config ごとの集計と、case 別の比較表
- `adjudication.md`：モデル名を伏せた採点ワークシート
- `adjudication-key.json`：ワークシートの ID とモデルの対応表

`summary.md` の指標のうち、正解データ無しで効くのは `quote 一致` です。
`comment.line` が指す行と `comment.quote` が一致するかを全コメントについて判定します。
プロンプトは context ファイルを 1 行ごとに番号付きで見せているため、この一致率はモデルが行番号を正しく数えられているかを直接表します。

`不在パス` は、fixture に存在しないファイルを引いたコメントの数です。
サーバー側の quote 検証は、context に無いファイルを引くコメントを落としません。
そこで harness 側で数えています。

`hit@line` / `hit@±2` / `hit@file` は、仕込んだバグを捕まえたかどうかを 3 段階で見ます。
`未対応/run` は、どの `expected` にも近接しなかったコメントの 1 回あたりの数です。
clean case ではこれが false positive の候補になります。

### トークン予算の計器

`prompt tokens` と `context 残余` は、`OLLAMA_CONTEXT_LENGTH`（32768）に対して入力がどれだけ詰まっていたかを示します。
残余が負なら、その run では prompt が context を実際に超えています。

`thinking tokens` は、レスポンスの `meta` に thinking の長さが載っていれば記録します。
載っていなければ `-` になります。

**`outputTokens` だけでは thinking の予算超過を測れません。**
`/review` は常に `format` を渡しますが、`format` を渡すと `eval_count` が content の分しか数えないことが実測で分かっています。
gemma4 では、think=true で `format` 無しなら eval=580 だったものが、`format` 有りでは eval=113 に落ちる一方、thinking の長さは 1242 で変わりませんでした。
thinking はトークンを消費しているのに `eval_count` には現れないため、別の計器が要ります。

thinking を載せるフィールドの名前はまだ確定していません。
harness は `meta` の中から名前に `think` を含む数値フィールドを拾い、無ければ `null` として扱います。
フィールドが増えても減っても壊れません。

## 盲検の採点

自動指標は、コメントが正しいかどうかまでは判定しません。
`adjudication.md` を開き、コメントごとに `判定` の行から該当する語だけを残します。
どのモデルの出力かは伏せてあるため、先入観の影響を避けられます。

採点を終えてから `adjudication-key.json` を開き、ID とモデルを突き合わせます。

## case を追加する

`cases/<id>/` に `case.json` と `base/`、`head/` を置きます。

**fixture のソースは必ず `.txt` 拡張子で置いてください。**
`src/cart.ts.txt` のように書きます。
`.txt` なら biome にも tsc にも、レビューの context 収集が使う `rg -g '*.ts'` にも引っかかりません。
このリポジトリ自身を `exoc-review` でレビューしたときに、仕込んだバグが混入しなくなります。

`base/` が base コミットの内容、`head/` がその上に重ねる内容です。
`mode` は 3 つあり、サーバーが集める diff が変わります。

- `base`：head を別ブランチにコミットし、`base: main` を指定します
- `worktree`：head を未コミットのまま置き、`git diff HEAD` を取らせます
- `staged`：head を stage して、`staged: true` を指定します

`expected` の各要素には行番号ではなく `anchor` を書きます。
anchor は head 適用後のファイル中に一意に現れる 1 行です。
一意でなければ `pnpm test` が落ちるため、fixture の腐りはテストで止まります。

## 現在の case

全 20 件です。
バグあり 12 件が検出率の母数、clean 6 件が false positive の母数、サイズ 2 件は母数に入れずレイテンシと切り捨ての観測に使います。

| id | category | mode | 仕込んだもの |
| --- | --- | --- | --- |
| `logic-inversion-01` | logic | base | 送料無料の判定で比較が反転している |
| `logic-boundary-02` | logic | base | 価格ティアの範囲判定で下限だけが排他になっている |
| `dataflow-stale-value-01` | dataflow | worktree | 割引後ではなく割引前の金額を換算に渡している |
| `dataflow-lost-update-02` | dataflow | worktree | 純粋化の際に書き込みだけコピー先に移り、読み出しが元の入力に残っている |
| `convention-nondeterminism-01` | convention | staged | `CLAUDE.md` が禁じた `src/sim/` での `Math.random()` |
| `convention-forbidden-api-02` | convention | base | 注入された `Clock` を使う規約に反して `Date.now()` を直接呼ぶ |
| `error-swallowed-01` | error-handling | staged | 送信失敗を握り潰したまま outbox から削除している |
| `error-unhandled-rejection-02` | error-handling | base | 新しい async 呼び出しにだけ `await` が無い |
| `concurrency-race-01` | concurrency | worktree | `await` を挟んだ read-modify-write で更新が失われる |
| `concurrency-floating-promise-02` | concurrency | staged | `forEach` のコールバックだけ `async` になり順序保証が壊れる |
| `resource-listener-leak-01` | resource | base | 再接続のたびに heartbeat の `setInterval` が積み上がる |
| `resource-unclosed-handle-02` | resource | worktree | 早期 return の経路だけロックが解放されない |
| `clean-refactor-01` | clean | base | バグなし。挙動不変のリファクタ |
| `clean-rename-02` | clean | base | バグなし。識別子の機械的な改名 |
| `clean-tests-added-03` | clean | staged | バグなし。テストの追加のみ |
| `clean-type-annotations-04` | clean | base | バグなし。型注釈の明示化 |
| `clean-bugfix-05` | clean | worktree | バグなし。実際のバグを正しく修正した差分 |
| `clean-dependency-update-06` | clean | base | バグなし。依存更新に伴う正しい追随 |
| `size-small-01` | size | base | minor units の二重変換（約 8,000 tokens の context） |
| `size-large-02` | size | base | 同一のバグ（約 23,600 tokens の context） |

`logic-inversion-01` と `dataflow-stale-value-01` と `convention-nondeterminism-01` の 3 件は、commit `a9d124c` で `qwen3:14b` への切り替えを判断したときに使った 3 問を復元したものです。
過去の判断との地続きを確保するために置いてあります。

`clean` の 6 件には、素の style nit を残さないよう注意を払っています。
指摘されうる点が混ざっていると、それはモデルの誤検出ではなく fixture の欠陥として false positive に計上されてしまうためです。

バグあり 12 件はいずれも合成で、実在の公開コミットを出典にはしていません。
各 `case.json` の `origin` に、何を模したものかと合成である旨を明記してあります。

## サイズ case で測るもの

`size` category の case だけは、目的が他と違います。
期待どおり検出できたかではなく、**入力が実際に何トークンだったか、切り捨てが起きたか**を記録することが目的です。

tokenizer の密度がモデルごとに違うためです。
同一の 291 文字に対する実測値は次のとおりでした。

| モデル | chars/token |
| --- | --- |
| `qwen3:14b` | 3.13 |
| `qwen3.5:9b` | 2.94 |
| `gemma4:12b` | 2.58 |

`packages/contract/src/limits.ts` の `CHARS_PER_TOKEN` は 3 です。
サーバーはこの値で入力量を見積もり、`MAX_INPUT_TOKENS` に収まるまで context を詰めます。
qwen3 では安全側に倒れますが、gemma4 では 16% の過小評価になります。

つまり `MAX_INPUT_TOKENS` 相当まで詰めた入力は、gemma4 では実トークンで context を超えます。
バグあり 12 件と clean 6 件は入力が小さいのでここを踏みません。
サイズ 2 件だけが踏みます。

そのため、サイズ case では `hit@±2` ではなく `prompt tokens` と `context 残余`、そして `dropped context files` を読んでください。
`summary.md` の case 別の表にどちらも出ます。
