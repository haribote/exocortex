# API の使い方

`ai-api` が公開する HTTP エンドポイントと、クライアントからの叩き方をまとめる。
クライアントは配布物を持たない。
`~/.claude/skills/` の skill と手打ちのシェルが、ここに記す固定のレシピをそのまま実行する。

認証は `Authorization: Bearer <token>` の共有シークレット 1 本である。
接続先とトークンは環境変数で渡す。

```bash
EXOCORTEX_ENDPOINT=http://<windows-ip>:11435
EXOCORTEX_TOKEN=<shared-secret>
```

## POST /review

リクエストは `multipart/form-data` で、2 つのパートを持つ。

- **params**：JSON 文字列。`{ "language": string, "base"?: string, "staged"?: boolean, "rules"?: string[] }`。`base` と `staged` は同時に指定できない。
- **snapshot**：リポジトリの tar.gz。作業ツリー（tracked と非 ignore の untracked）に `.git` を加えたもの。

サーバーは snapshot を隔離した一時ディレクトリに展開し、`git diff` で差分を求め、関連ファイルを走査して context を組み、レビューを返す。
差分の分岐は params で決まる。
`base` があれば `{base}...HEAD`、`staged` があれば `--cached`、どちらも無ければ作業ツリーと `HEAD` の差分である。

### 正規レシピ

```bash
root=$(git rev-parse --show-toplevel)
tmp=$(mktemp -d)
tar --no-mac-metadata -czf "$tmp/snapshot.tgz" -C "$root" \
  --null -T <(git -C "$root" ls-files -z --cached --others --exclude-standard) .git
curl -sf -H "Authorization: Bearer $EXOCORTEX_TOKEN" \
  -F 'params={"language":"typescript","base":"main"}' \
  -F "snapshot=@$tmp/snapshot.tgz;type=application/gzip" \
  "$EXOCORTEX_ENDPOINT/review"
rm -rf "$tmp"
```

`.gitignore` の対象（`node_modules` など）は除外し、`.git` は含める。
`.git` を含めるのは、サーバーが履歴に対して native の git を回して差分を求めるためである。
`--no-mac-metadata` は macOS 固有のフラグで、`._*` の AppleDouble ファイルや `com.apple.provenance` などの拡張属性を snapshot に載せないためにある。
これを付けないと展開先に余計なファイルが混ざる。
サーバーは展開時に所有者を復元しない（`tar --no-same-owner`）ので、macOS 側の uid がそのまま持ち込まれて git が dubious ownership で止まることはない。

### レスポンス

```jsonc
{
  "summary": "...",
  "comments": [
    { "severity": "major", "file": "src/foo.ts", "line": 42, "quote": "...", "message": "..." }
  ],
  "meta": {
    "model": "qwen3:14b",
    "inputTokens": 12043,
    "durationMs": 18234,
    "droppedComments": 1,
    "droppedContextFiles": 2
  }
}
```

`severity` は `critical` / `major` / `minor` / `info` の 4 値である。
`quote` は指摘した行を逐語でコピーしたもので、context に照合できないコメントはサーバーが破棄する。
その破棄数が `meta.droppedComments` である。
`meta.droppedContextFiles` は、予算に収めるためにサーバーが落とした context ファイルの数である。

## POST /translate

リポジトリを持たないので snapshot は要らない。
JSON を直接 POST する。

```bash
curl -sf -H "Authorization: Bearer $EXOCORTEX_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"text":"こんにちは","from":"ja","to":"en"}' \
  "$EXOCORTEX_ENDPOINT/translate"
# → {"text":"Hello"}
```

`from` と `to` は必須で、翻訳方向は推測しない。

## エラー

クライアントが次の行動を選べる粒度で返す。

| 状況 | HTTP | error |
|---|---|---|
| リクエスト不正（params の欠落、snapshot の欠落、不正な base、展開失敗） | 400 | `invalid_request` / `invalid_snapshot` / `no_changes` |
| token 不一致 | 401 | `unauthorized` |
| Ollama がエラーを返した | 502 | `ollama_error` / `invalid_model_output` |
| Ollama 到達不可 | 503 | `ollama_unreachable` |
| 推論タイムアウト | 504 | `inference_timeout` |
| snapshot 過大、または diff 単体が context 予算を超過 | 413 | `snapshot_too_large` / `context_too_large` |

エラーの body は `{ "error": string, "message": string }` である。
