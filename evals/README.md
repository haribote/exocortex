# @exocortex/evals

`REVIEW_MODEL` を差し替えたときのレビュー品質を、再現可能な形で比較するための eval harness である。

## 何を測るか

本番の `POST /review` を HTTP 越しに叩いて測る。
Ollama を直接叩いたり、プロンプトを組み直したりはしない。
比較したいのはモデル単体の賢さではなく、prompt と context packing と quote 検証を通した後にユーザーが受け取るレビューの質だからである。

case ごとに、バグを仕込んだ小さな TypeScript リポジトリを一時ディレクトリに組み立て、その snapshot を送る。
仕込んだバグの位置は `case.json` の `anchor`（head ファイル中に一意に現れる 1 行）で示す。
行番号は実行時に anchor から解決するため、fixture を編集しても行番号がずれない。

## セットアップ

リポジトリのルートで依存を入れ、`@exocortex/contract` をビルドする。

```bash
pnpm install
pnpm -r build
```

`evals` 自体のビルドは要らない。
Node 24 の型ストリッピングで `.ts` をそのまま実行する。

## 単体テスト

fixture と採点ロジックのテストは、推論サーバーも GPU も要らない。

```bash
pnpm --filter @exocortex/evals test
```

このテストが守っているのは次の点である。

- **anchor の一意性**：全 case の全 anchor が、対応するファイルにちょうど 1 回だけ現れる
- **fixture の隔離**：`createFixture` は `mkdtemp` 配下にしかリポジトリを作らず、case のソースディレクトリを書き換えない
- **diff の内容**：`base` / `worktree` / `staged` の 3 モードそれぞれで、サーバーが集める diff に仕込んだ行が現れる
- **切り替えコマンドの安全性**：`<|think|>` のような shell metacharacter を含む値が、リモートに literal のまま届く
- **既定でリモートを触らないこと**：`--switch` が無ければ config は単なるラベルに解決される

## 計測の実行

計測にはレビューサーバーが要る。
ディストロを起こし、SSH トンネルを張ってから実行する。

```bash
ssh exocortex "wsl -d exocortex -- /bin/true"
pkill -f "11435:127.0.0.1:11435"
ssh -f -N -o ExitOnForwardFailure=yes -L 11435:127.0.0.1:11435 exocortex
```

既定では、harness はサーバーを一切触らない。
比較したいモデルはサーバー側の環境変数で決まるため、自分で切り替えてから測る。
サーバーで `REVIEW_MODEL` を設定してコンテナを再起動し、そのモデル名を `--configs` に渡す。

```bash
cd evals
node src/run.ts --run 2026-07 --configs gemma4:12b --repeats 3
```

サーバーが報告した `meta.model` が `--configs` の値と食い違うと警告が出る。
再起動を忘れたまま測ってしまう事故は、これで気付ける。

モデルを入れ替えたら、同じ `--run` で次の config を測る。
結果は同じ `results.ndjson` に追記される。

オプションは次のとおりである。

- `--run <id>`：出力先を `runs/<id>/` に決める（既定 `default`）
- `--configs <a,b>`：計測する config。`--switch` の有無で意味が変わる（下記）
- `--cases <a,b>`：case を絞る（既定は全件）
- `--repeats <n>`：同じ組み合わせを何回測るか（既定 1）
- `--endpoint <url>`：レビューサーバーの URL（既定 `http://localhost:11435`）
- `--timeout <ms>`：1 リクエストの上限（既定 600000）
- `--switch`：config ごとにサーバーを切り替える（下記）
- `--health-timeout <ms>`：切り替え後に `/health` を待つ上限（既定 180000）

## 無人実行のための自動切り替え

6 config を 1 つずつ手で切り替えるのは、一晩の無人実行には向かない。
`--switch` を付けると、harness が config ごとにサーバーを再作成してから測る。

```bash
node src/run.ts --run 2026-07 --switch --repeats 3
```

`--switch` を付けたときだけ、harness はリモートを触る。
付けなければ従来どおり、config は単なるラベルで、モデル不一致は警告に留まる。
事故で本番サービスを再起動しないための切り分けである。
`EXOCORTEX_SWITCH=1` でも有効にできる。

`--switch` を付けると、`--configs` の意味がラベルから `configs.json` の id に変わる。
`--configs` を省略すると `configs.json` の全 config を順に測る。

### configs.json

計測する config は `configs.json` に定義する。
`id` と、サーバーに設定する環境変数の組である。

```json
[
  { "id": "C0", "env": { "REVIEW_MODEL": "qwen3:14b" } },
  {
    "id": "C2",
    "env": { "REVIEW_MODEL": "gemma4:12b", "REVIEW_THINK": "false" }
  }
]
```

現在の 6 config は次のとおりである。
`runs/main-01` を再現できるよう、入れ替え前の構成のまま残してある。

| id | REVIEW_MODEL | 設定 |
| --- | --- | --- |
| C0 | `qwen3:14b` | なし。thinking 有効で、入れ替え前の本番構成 |
| C0p | `qwen3:14b` | `REVIEW_SYSTEM_MODE=prefix` |
| C1 | `gemma4:12b` | なし。thinking 有効。**この構成を採用した** |
| C2 | `gemma4:12b` | `REVIEW_THINK=false` |
| C3 | `qwen3.5:9b` | なし |
| C4 | `gpt-oss:20b` | `REVIEW_THINK=high` |

次にモデルを替えるときは、そのときの本番構成を baseline として先頭に置く。

thinking の有無の対照は `REVIEW_THINK` で作る。
`gemma4:12b` は `think` 未指定と `think: true` が完全に同一の結果になり、thinking は既定で有効だと実測で分かったためである。
`think: false` は 3 モデルすべてで thinking を確実に止める。

`env` に書いた変数だけがサーバーに渡る。
ある config で指定しなかった変数は、compose ファイルの既定値に戻る。
つまり各 config は差分ではなく、環境の完全な指定である。

### 接続先の環境変数

接続先はハードコードしていない。
既定値は次のとおりで、いずれも環境変数で上書きできる。

- `EXOCORTEX_SSH_HOST`：ssh の host（既定 `exocortex`）
- `EXOCORTEX_WSL_DISTRO`：WSL のディストロ名（既定 `exocortex`）
- `EXOCORTEX_COMPOSE_DIR`：compose ファイルのあるディレクトリ（既定 `/home/haribote/exocortex`）
- `EXOCORTEX_API_SERVICE`：再作成する compose サービス名（既定 `ai-api`）

`ollama` サービスは再作成しない。
`OLLAMA_MAX_LOADED_MODELS=1` が新しいモデルへの入れ替えを行う。

### 切り替えの手順

各 config のバッチに入る前に、harness は次を順に行う。

1. ssh 経由で `ai-api` を新しい環境変数で再作成する
2. `/health` が `{"status":"ok"}` を返すまで待つ
3. warm-up リクエストを 1 件投げて、その結果を捨てる
4. `meta.model` が config の `REVIEW_MODEL` と一致することを確認する
5. `ollama ps` を取得して `environment.md` に追記する

warm-up の結果を捨てるのは、切り替え後の最初の 1 件がモデルのロード時間を含むからである。
これを記録に混ぜると、その config だけレイテンシが実態より悪く出る。

`meta.model` が食い違ったときは、その config を中断して次へ進む。
ラベルと中身が食い違ったデータを記録しないためである。
中断した事実は `environment.md` に残り、終了コードは 1 になる。
ssh が失敗したときと `/health` が返らなかったときも同じ扱いである。

`environment.md` には config ごとに `ollama ps` の出力が残る。
`100% GPU` でない config は、重みの一部が CPU に落ちている。
その場合はレイテンシ比較から除外する必要があるため、`environment.md` にその旨を書き添える。

## 途中で落ちたとき

結果は 1 件測るごとに `runs/<id>/results.ndjson` へ追記される。
同じ `--run` で再実行すると、記録済みの `(config, case, repeat)` を読み飛ばして続きから再開する。

SSH トンネルが切れたり WSL の VM が idle で落ちたりして接続自体が失敗した場合、その 1 件は記録せずに実行を打ち切る。
トンネルを張り直して同じコマンドを再実行する。

サーバーが 502 や 504 を返した場合は、計測結果として記録する。
生のレスポンス body も残るため、後から原因を追える。

## レポートの生成

```bash
node src/report.ts --run 2026-07
```

`runs/<id>/` に 3 つのファイルが出る。

- `summary.md`：config ごとの集計と、case 別の比較表
- `adjudication.md`：モデル名を伏せた採点ワークシート
- `adjudication-key.json`：ワークシートの ID とモデルの対応表

`summary.md` の指標のうち、正解データ無しで効くのは `quote 一致` である。
`comment.line` が指す行と `comment.quote` が一致するかを全コメントについて判定する。
プロンプトは context ファイルを 1 行ごとに番号付きで見せているため、この一致率はモデルが行番号を正しく数えられているかを直接表す。

`不在パス` は、fixture に存在しないファイルを引いたコメントの数である。
サーバー側の quote 検証は、context に無いファイルを引くコメントを落とさない。
そこで harness 側で数えている。

`hit@line` / `hit@±2` / `hit@file` は、仕込んだバグを捕まえたかどうかを 3 段階で見る。
`未対応/run` は、どの `expected` にも近接しなかったコメントの 1 回あたりの数である。
clean case ではこれが false positive の候補になる。

### トークン予算の計器

`prompt tokens` と `context 残余` は、`OLLAMA_CONTEXT_LENGTH`（32768）に対して入力がどれだけ詰まっていたかを示す。
残余が負なら、その run では prompt が context を実際に超えている。

思考は prompt 側に積み上がるため、`promptEvalTokens` は `inputTokens` の見積もりを上回る。
`main-01` の `gemma4:12b` 56 件では、その差は p50 が 5286、p95 が 8295、最大 21411 トークンだった。
入力の大きさではなく case の難しさで決まるので、入力長からは予測できない。

`outputTokens` だけでは、この超過を測れない。
`/review` は常に `format` を渡すが、`format` を渡すと `eval_count` が content の分しか数えないことが実測で分かっている。
`gemma4:12b` では、think=true で `format` 無しなら eval=580 だったものが、`format` 有りでは eval=113 に落ちる一方、thinking の長さは 1242 で変わらなかった。
思考はトークンを消費しているのに `eval_count` には現れないため、別の計器が要る。

`thinking tokens` は、レスポンスの `meta` に思考の長さが載っていれば記録する。
載っていなければ `-` になる。
フィールドの名前はまだ確定していないため、harness は `meta` の中から名前に `think` を含む数値フィールドを拾う。
フィールドが増えても減っても壊れない。

## 盲検の採点

自動指標は、コメントが正しいかどうかまでは判定しない。
`adjudication.md` を開き、コメントごとに `判定` の行から該当する語だけを残す。
どのモデルの出力かは伏せてあるため、先入観の影響を避けられる。

採点を終えてから `adjudication-key.json` を開き、ID とモデルを突き合わせる。

## case を追加する

`cases/<id>/` に `case.json` と `base/`、`head/` を置く。

fixture のソースは必ず `.txt` 拡張子で置く。
`src/cart.ts.txt` のように書く。
`.txt` なら biome にも tsc にも、レビューの context 収集が使う `rg -g '*.ts'` にも引っかからない。
このリポジトリ自身を `exoc-review` でレビューしたときに、仕込んだバグが混入しなくなる。

`base/` が base コミットの内容、`head/` がその上に重ねる内容である。
`mode` は 3 つあり、サーバーが集める diff が変わる。

- `base`：head を別ブランチにコミットし、`base: main` を指定する
- `worktree`：head を未コミットのまま置き、`git diff HEAD` を取らせる
- `staged`：head を stage して、`staged: true` を指定する

`expected` の各要素には行番号ではなく `anchor` を書く。
anchor は head 適用後のファイル中に一意に現れる 1 行である。
一意でなければ `pnpm test` が落ちるため、fixture の腐りはテストで止まる。

## 現在の case

全 20 件である。
バグあり 12 件が検出率の母数、clean 6 件が false positive の母数、サイズ 2 件は母数に入れずレイテンシと切り捨ての観測に使う。

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

`logic-inversion-01` と `dataflow-stale-value-01` と `convention-nondeterminism-01` の 3 件は、commit `a9d124c` で `qwen3:14b` への切り替えを判断したときに使った 3 問を復元したものである。
過去の判断との地続きを確保するために置いてある。

`clean` の 6 件には、素の style nit を残さないよう注意を払っている。
指摘されうる点が混ざっていると、それはモデルの誤検出ではなく fixture の欠陥として false positive に計上されてしまうためである。

バグあり 12 件はいずれも合成で、実在の公開コミットを出典にはしていない。
各 `case.json` の `origin` に、何を模したものかと合成である旨を明記してある。

## サイズ case で測るもの

`size` category の case だけは、目的が他と違う。
期待どおり検出できたかではなく、入力が実際に何トークンだったか、切り捨てが起きたかを記録することが目的である。

tokenizer の密度がモデルごとに違う。
同一の 291 文字に対する実測値は次のとおりだった。

| モデル | chars/token |
| --- | --- |
| `qwen3:14b` | 3.13 |
| `qwen3.5:9b` | 2.94 |
| `gemma4:12b` | 2.58 |

`packages/contract/src/limits.ts` の `CHARS_PER_TOKEN` は 3 である。
サーバーはこの値で入力量を見積もり、`MAX_INPUT_TOKENS` に収まるまで context を詰める。
qwen3 では安全側に倒れるが、gemma4 では 16% の過小評価になる。

ただし、この過小評価だけで context を超えるわけではない。
`size-large-02` を thinking 無効の `gemma4:12b`（C2）で回すと 3 回とも成功し、検出もできている。
入力そのものは収まっており、超えさせているのは思考である。

そのため、サイズ case では `hit@±2` ではなく `prompt tokens` と `context 残余`、そして `dropped context files` を読む。
`summary.md` の case 別の表にいずれも出る。

`main-01` の後に `RESERVED_OUTPUT_TOKENS` を 12288 へ引き上げたため、`MAX_INPUT_TOKENS` は 28672 から 20480 に下がった。
`size-large-02` は 28672 の直下を狙って作ったので、現在は予算を超えて context が落とされる側に回っている。
`main-01` の数値と直接は比較できない。

## main-01 の結果と採用の判断

2026-07-25 に 6 config × 20 case × 3 repeat の 360 リクエストを実行した。
生データは `runs/main-01/results.ndjson`、集計は `runs/main-01/summary.md` にある。

| config | schemaOk | 検出 | clean の major 以上 | 引用の整合 |
| --- | --- | --- | --- | --- |
| C0 `qwen3:14b`（入れ替え前） | 88.3% | 8/12 | 4 | 84.2% |
| C0p `qwen3:14b` + system role | 93.3% | 9/12 | 3 | 69.8% |
| **C1 `gemma4:12b`** | **93.3%** | **12/12** | **0** | **100%** |
| C2 `gemma4:12b` think=false | 100% | 9/12 | 6 | 100% |
| C3 `qwen3.5:9b` | 80.0% | 9/12 | 9 | 80.8% |
| C4 `gpt-oss:20b` think=high | 78.3% | 11/12 | 12 | 94.2% |

C1 を採用した。
事前に決めた 5 つのゲートのうち、ゲート 1 だけを満たしていない。

ゲート 1 は「`schemaOk` が 95% 以上」で、C1 は 93.3% である。
ただし C1 の失敗 4 件はすべてサイズ 2 件に集中しており、残る 18 case では 54/54 で 100% だった。
同じ 18 case で C0 は 47/54（87.0%）であり、7 件の失敗が 4 つの通常 case に散らばっていた。
日常のレビューにあたる範囲では、C1 のほうが安定している。

ゲート 2（非退行）、3（優位。C1 のみ検出 4 件、C0 のみ 0 件）、4（誤検出 0 に対し 4）、5（引用 100% に対し 84.2%）はいずれも通過している。
未達成のゲート 1 を承知の上で採用した、という判断である。

なお、この run では盲検の採点を行っていない。
自動で採れる指標だけで差が明確についたため、人手の採点に進む前に判断した。
正しい行を指しながら理由が見当違いな指摘がどの程度あるかは、分かっていない。

### 測定で分かったモデルの性質

思考の有無が精度を大きく左右する。
同じ `gemma4:12b` で思考を切ると、検出が 12/12 から 9/12 に落ち、誤検出が 0 から 6 に増えた。
代わりに平均所要は 77.1 秒から 2.5 秒になる。
速度を優先する用途では `REVIEW_THINK=false` という選択肢がある。

指摘するものが無い差分で、思考が発散する傾向がある。
Qwen 系の 3 config は `clean-type-annotations-04` で 3 回とも失敗し、`gpt-oss:20b` は `clean-dependency-update-06` と `clean-rename-02` で失敗した。
`gemma4:12b` の思考有効だけが clean 6 件を無傷で通している。
機構は特定できていない。
