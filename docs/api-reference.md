# API reference

`ai-api` が公開する HTTP エンドポイントと、クライアントからの叩き方をまとめます。
クライアントは配布物を持たず、`~/.claude/skills/` の skill と手打ちのシェルが、ここに記す固定のレシピをそのまま実行します。

認証は SSH の公開鍵認証に委ねます。
`ai-api` は Windows の loopback にだけ publish しており、LAN からは到達できません。
クライアントは SSH port forwarding でトンネルを張り、`localhost` 宛てに叩きます。
届いたリクエストは、すでに鍵認証を通ったものだけです。

トンネルを張る前にディストロを起こします。
idle が続くと WSL の VM ごと停止するため、起こさずに繋ぐと接続を拒否されます。

```bash
ssh exocortex "wsl -d exocortex -- /bin/true"
ssh -f -N -o ExitOnForwardFailure=yes -L 11435:127.0.0.1:11435 exocortex
```

転送先を `localhost` ではなく `127.0.0.1` と書くのは、Windows 側で `localhost` が `::1` に解決されると届かないためです。

接続先は環境変数で渡します。

```bash
EXOCORTEX_ENDPOINT=http://localhost:11435
```

用が済んだらトンネルを閉じます。

```bash
pkill -f "11435:127.0.0.1:11435"
```

## POST /review

リクエストは `multipart/form-data` で、2 つのパートを持ちます。

- **params**：JSON 文字列。`{ "language": string, "base"?: string, "staged"?: boolean, "rules"?: string[] }`。`base` と `staged` は同時に指定できません。
- **snapshot**：リポジトリの tar.gz。作業ツリー（tracked と非 ignore の untracked）に `.git` を加えたものです。

サーバーは snapshot を隔離した一時ディレクトリに展開し、`git diff` で差分を求め、関連ファイルを走査して context を組み、レビューを返します。
差分の分岐は params で決まります。
`base` があれば `{base}...HEAD`、`staged` があれば `--cached`、どちらも無ければ作業ツリーと `HEAD` の差分です。

### 正規レシピ

```bash
root=$(git rev-parse --show-toplevel)
tmp=$(mktemp -d)
tar --no-mac-metadata -czf "$tmp/snapshot.tgz" -C "$root" \
  --null -T <(git -C "$root" ls-files -z --cached --others --exclude-standard) .git
curl -sf \
  -F 'params={"language":"typescript","base":"main"}' \
  -F "snapshot=@$tmp/snapshot.tgz;type=application/gzip" \
  "$EXOCORTEX_ENDPOINT/review"
rm -rf "$tmp"
```

`.gitignore` の対象（`node_modules` など）は除外し、`.git` は含めます。
`.git` を含めるのは、サーバーが履歴に対して native の git を回して差分を求めるためです。
`--no-mac-metadata` は macOS 固有のフラグで、`._*` の AppleDouble ファイルや `com.apple.provenance` などの拡張属性を snapshot に載せないためにあります。
これを付けないと展開先に余計なファイルが混ざります。
サーバーは展開時に所有者を復元しない（`tar --no-same-owner`）ので、macOS 側の uid がそのまま持ち込まれて git が dubious ownership で止まることはありません。

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

`severity` は `critical` / `major` / `minor` / `info` の 4 値です。
`quote` は指摘した行を逐語でコピーしたもので、context に照合できないコメントはサーバーが破棄します。
その破棄数が `meta.droppedComments` です。
`meta.droppedContextFiles` は、予算に収めるためにサーバーが落とした context ファイルの数です。

## POST /translate

リポジトリを持たないので snapshot は要りません。
JSON を直接 POST します。レスポンスは NDJSON のストリームで返ります。
バッファされないよう `curl` には `-N` を付けます。

```bash
curl -Nsf -H 'Content-Type: application/json' \
  -d '{"text":"こんにちは","from":"ja","to":"en"}' \
  "$EXOCORTEX_ENDPOINT/translate"
# {"delta":"Hello"}
# {"done":true,"meta":{"model":"translategemma:12b","durationMs":870}}
```

`from` と `to` は必須で、翻訳方向は推測しません。

`Content-Type` は `application/x-ndjson` です。1 行 1 JSON で、行の種類は次のとおりです。

| 行 | 意味 |
|---|---|
| `{"delta":"..."}` | 訳文の断片。到着順に連結すると訳文になる |
| `{"heartbeat":true}` | 初回 delta が出るまでの生存信号。無視してよい |
| `{"done":true,"meta":{...}}` | 正常終了。これが来たら成功 |
| `{"error":"...","message":"..."}` | 途中失敗。訳文は不完全 |

モデルのロードには 30 秒ほどかかることがあり、その間は `heartbeat` だけが流れます。

**HTTP 200 は成功を意味しません。** ストリームを開始した時点でステータスは確定するため、
生成の途中で失敗しても 200 のまま `error` 行で終わります。
成功判定は `done` 行の到達で行います。`done` も `error` も来ずにストリームが切れたら失敗として扱います。

## エラー

クライアントが次の行動を選べる粒度で返します。

`/review` はレスポンス全体を 1 つの JSON で返すため、下表の HTTP ステータスがそのまま返ります。

| 状況 | HTTP | error |
|---|---|---|
| リクエスト不正（params の欠落、snapshot の欠落、不正な base、展開失敗） | 400 | `invalid_request` / `invalid_snapshot` / `no_changes` |
| Ollama がエラーを返した | 502 | `ollama_error` / `invalid_model_output` |
| Ollama 到達不可 | 503 | `ollama_unreachable` |
| 推論タイムアウト | 504 | `inference_timeout` |
| snapshot 過大、または diff 単体が context 予算を超過 | 413 | `snapshot_too_large` / `context_too_large` |

エラーの body は `{ "error": string, "message": string }` です。

`/translate` は、ストリームを開始する前の失敗（到達不可・即時のモデル不在など）は上表と同じ
HTTP ステータス + JSON body で返します。開始後の失敗は同じ `error` slug を `error` 行として NDJSON に流します。
