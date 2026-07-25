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

## 計測の実行

計測にはレビューサーバーが要ります。
ディストロを起こし、SSH トンネルを張ってから実行します。

```bash
ssh exocortex "wsl -d exocortex -- /bin/true"
pkill -f "11435:127.0.0.1:11435"
ssh -f -N -o ExitOnForwardFailure=yes -L 11435:127.0.0.1:11435 exocortex
```

比較したいモデルはサーバー側の環境変数で決まるため、一度に 1 つずつ測ります。
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
- `--configs <a,b>`：計測する config のラベル。モデル名をそのまま書きます（既定 `default`）
- `--cases <a,b>`：case を絞ります（既定は全件）
- `--repeats <n>`：同じ組み合わせを何回測るか（既定 1）
- `--endpoint <url>`：レビューサーバーの URL（既定 `http://localhost:11435`）
- `--timeout <ms>`：1 リクエストの上限（既定 600000）

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

| id | category | mode | 仕込んだもの |
| --- | --- | --- | --- |
| `logic-inversion-01` | logic | base | 送料無料の判定で比較が反転している |
| `dataflow-stale-value-01` | dataflow | worktree | 割引後ではなく割引前の金額を換算に渡している |
| `convention-nondeterminism-01` | convention | staged | `CLAUDE.md` が禁じた `src/sim/` での `Math.random()` |
| `clean-refactor-01` | clean | base | バグなし。false positive の測定用 |

前の 3 件は、commit `a9d124c` で `qwen3:14b` への切り替えを判断したときに使った 3 問を復元したものです。
