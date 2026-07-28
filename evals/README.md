# @exocortex/evals

`REVIEW_MODEL` を差し替えたときのレビュー品質を、再現可能な形で比較するための eval harness である。
本番のデフォルト構成を基準に、任意のモデルを候補として並べて測れる。
新しいモデルが出たときに、乗り換える価値があるかを判定するために置いてある。

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
- **既定でリモートを触らないこと**：`--switch` が無ければ config は単なるラベルに解決され、モデルの検証も走らない
- **測る前に止まること**：`REVIEW_MODEL` がサーバーに無い config があると、1 件も測らずに欠けている一覧を出して終わる
- **デフォルト構成の位置**：`default` は常に先頭で 1 回だけ測られる

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

`--configs` を省略すると、その 1 件は `current` という id で記録される。
サーバーの現状をそのまま測った、という意味である。

モデルを入れ替えたら、同じ `--run` で次の config を測る。
結果は同じ `results.ndjson` に追記される。

オプションは次のとおりである。

- `--run <id>`：出力先を `runs/<id>/` に決める（既定 `default`）
- `--configs <a,b>`：計測する config。`--switch` の有無で意味が変わる（下記）
- `--candidates <a,b>`：候補のモデル名。各名前がそのまま config になる。`--switch` が要る（下記）
- `--configs-file <path>`：config 定義を追加で読む。`--switch` が要る（下記）
- `--cases <a,b>`：case を絞る（既定は全件）
- `--repeats <n>`：同じ組み合わせを何回測るか（既定 1）
- `--endpoint <url>`：レビューサーバーの URL（既定 `http://localhost:11435`）
- `--timeout <ms>`：1 リクエストの上限（既定 960000）。サーバーが `inference_timeout` を返す 600000 より上に置いてある
- `--switch`：config ごとにサーバーを切り替える（下記）
- `--pull`：サーバーに無いモデルを `ollama pull` で取得する。`--switch` が要る
- `--health-timeout <ms>`：切り替え後に `/health` を待つ上限（既定 180000）

## 無人実行のための自動切り替え

候補を 1 つずつ手で切り替えるのは、一晩の無人実行には向かない。
`--switch` を付けると、harness が config ごとにサーバーを再作成してから測る。

```bash
node src/run.ts --run 2026-08 --switch --candidates gemma4:26b,qwen3.5:27b --repeats 3
```

`--switch` を付けたときだけ、harness はリモートを触る。
付けなければ従来どおり、config は単なるラベルで、モデル不一致は警告に留まる。
事故で本番サービスを再起動しないための切り分けである。
`EXOCORTEX_SWITCH=1` でも有効にできる。

`--switch` を付けると、`--configs` の意味がラベルから config の id に変わる。
`--configs` を省略すると、`default` と `--candidates`、`--configs-file` で足した config を順に測る。

### 候補の加え方

config は `id` と、サーバーに設定する環境変数の組である。
tracked な `configs.json` にはデフォルト構成だけが入っている。

```json
[{ "id": "default", "env": { "REVIEW_MODEL": "gemma4:12b" } }]
```

id が `default` の config は、本番のデフォルト構成をそのまま写したものである。
候補はこれとのペア比較で判定するため、harness は `default` を常に先頭で 1 回だけ測る。

候補を加える経路は 2 つある。
既定のノブのまま新しいモデルを試すなら、`--candidates` にモデル名を並べる。
各名前がそのまま config の id になり、`env` は `REVIEW_MODEL` だけを持つ。

`REVIEW_THINK` や `REVIEW_SYSTEM_MODE` を変えた対照を作るなら、config を書いたファイルを `--configs-file` に渡す。

```json
[
  {
    "id": "thinkless",
    "env": { "REVIEW_MODEL": "gemma4:12b", "REVIEW_THINK": "false" }
  }
]
```

このファイルは `configs.local.json` という名前を慣習とし、`.gitignore` に入れてある。
tracked なファイルを編集せずに済むため、clone や fork した先で `git pull` が衝突しない。

ファイル自身が `default` という id を定義していれば、そちらが優先される。
デフォルト構成を二重に測ることはない。
`--candidates` との併用もできる。

同じモデルで 1 つの変数だけを変えた組を混ぜておくと、差がモデルによるものか設定によるものかを切り分けられる。

thinking の有無の対照は `REVIEW_THINK` で作る。
thinking が既定で有効なモデルもあるため、止めるには `false` を明示的に渡す。

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

### モデルが揃っているかの検証

`--switch` を付けたときは、1 件も測る前に、全 config の `REVIEW_MODEL` がサーバーにあるかを確かめる。
`ollama list` の出力と照合し、欠けているモデルがあれば、その一覧を出してそこで終了する。

この検証を省くと、欠けているモデルは warm-up の失敗として現れ、その config は飛ばされる。
一晩の無人実行では、朝になって初めて気付くことになる。
Ollama は `ollama run` なら自動で pull するが、harness が通る `/api/chat` では pull しないため、この経路では取得されない。

`--pull` を付けたときだけ、欠けているモデルを `ollama pull` で取得してから先へ進む。
既定にしていないのは、モデル名をタイプミスしたときに意図しない大きなダウンロードが始まらないようにするためである。

`--switch` が無いときは検証しない。
config が単なるラベルで、モデルを制御していないからである。

### 切り替えの手順

検証を通ったあと、各 config のバッチに入る前に、harness は次を順に行う。

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

`prompt tokens` と `context 残余` は、`MAX_CONTEXT_TOKENS` に対して入力がどれだけ詰まっていたかを示す。
残余が負なら、その run では prompt が context を実際に超えている。

思考は prompt 側に積み上がるため、`promptEvalTokens` は `inputTokens` の見積もりを上回る。
上回る量は入力の大きさではなく case の難しさで決まるので、入力長からは予測できない。
この超過は `MAX_INPUT_TOKENS` の外側で起きるため、サーバー側の見積もりを見ているだけでは気付けない。

`outputTokens` だけでは、この超過を測れない。
`/review` は常に `format` を渡すが、`format` を渡すと `eval_count` は content の分しか数えない。
思考はトークンを消費しているのに `eval_count` には現れないため、別の計器が要る。

`thinking tokens` は、レスポンスの `meta` に思考の長さが載っていれば記録する。
載っていなければ `-` になる。
フィールドの名前はまだ確定していないため、harness は `meta` の中から名前に `think` を含む数値フィールドを拾う。
フィールドが増えても減っても壊れない。

## 出力元を伏せて採点する

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
| `size-small-01` | size | base | minor units の二重変換（約 8,200 tokens の context） |
| `size-large-02` | size | base | 同一のバグ（約 26,300 tokens の context） |

`logic-inversion-01` と `dataflow-stale-value-01` と `convention-nondeterminism-01` の 3 件は、commit `a9d124c` の判断に使われた 3 問を復元したものである。
過去の測定と地続きに読めるようにするために置いてある。

`clean` の 6 件には、素の style nit を残さないよう注意を払っている。
指摘されうる点が混ざっていると、それはモデルの誤検出ではなく fixture の欠陥として false positive に計上されてしまうためである。

バグあり 12 件はいずれも合成で、実在の公開コミットを出典にはしていない。
各 `case.json` の `origin` に、何を模したものかと合成である旨を明記してある。

## サイズ case で測るもの

`size` category の case だけは、目的が他と違う。
期待どおり検出できたかではなく、入力が実際に何トークンだったか、切り捨てが起きたかを記録することが目的である。

サーバーは `packages/contract/src/limits.ts` の `CHARS_PER_TOKEN` で入力量を見積もり、`MAX_INPUT_TOKENS` に収まるまで context を詰める。
tokenizer の密度はモデルごとに違うため、この係数はモデルを乗り換えるたびに見直す対象になる。
密度を過小に見積もると、収まると判断した入力が実際には溢れる。

入力が収まっていても、context の超過はなくならない。
思考は prompt 側に積み上がるうえ、同じ入力を同じ設定で回しても長さが揺れるためである。
超えさせているのは入力ではなく思考であり、サーバー側の見積もりからは見えない。

そのため、サイズ case では `hit@±2` ではなく `prompt tokens` と `context 残余`、そして `dropped context files` を読む。
`summary.md` の case 別の表にいずれも出る。

`size-large-02` は `MAX_INPUT_TOKENS` を超える大きさで、context が落とされる側にある。
`size-small-01` は余裕を持って収まる。
2 件は同じバグと同じ diff を持ち、周辺の context の量だけが違うので、予算を超えたときに何が変わるかを対照で読める。

fixture の大きさは `MAX_INPUT_TOKENS` を基準に決めてある。
この定数と `CHARS_PER_TOKEN` のどちらかを動かしたときは、サイズ 2 件が意図した側に留まっているかを確かめる。

## 採否をどう決めるか

比較する指標が多いので、判定の基準はレポートを開く前に決めておく。
後から基準を作ると、どの候補でも勝たせられる。

目安として、次の 5 つを順に見る。

1. **動作可能性**：`schemaOk` が閾値以上であること。壊れた出力を返す割合が高ければ、品質以前に使えない
2. **非退行**：デフォルト構成が検出できている case を落とさないこと
3. **優位**：case 別のペア比較で、候補のみが検出した case 数がデフォルト構成のみを一定数上回ること
4. **誤検出**：clean case で `major` 以上の指摘がデフォルト構成を上回らないこと
5. **引用の質**：`quote 一致` がデフォルト構成から大きく落ちないこと

3 をペア比較にするのは、母数が小さいためである。
バグあり 12 件では検出率の標準誤差が ±14pt 程度あり、集計値の大小では 7/12 と 9/12 を区別できない。
同じ case を同じ順で解かせている以上、case ごとの勝ち負けを数えるほうが感度が高い。

閾値そのものは測定の目的によって変わる。
`runs/<id>/summary.md` と、そのとき使った基準を並べて残しておくと、次の比較で同じ検討を繰り返さずに済む。