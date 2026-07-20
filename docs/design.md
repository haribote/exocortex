# 設計

## 目的

自宅の Windows マシン (RTX 5080) をローカル LLM 推論サーバーとして動かし、Mac の開発環境から HTTP 経由でコードレビューと日英翻訳を依頼する。

初期スコープは 2 つのエンドポイントに絞る。
git diff のレビューと、日英翻訳である。

エージェント（Claude Code、Codex）はローカル LLM の存在を直接知らない。
Mac 上の CLI を呼ぶだけで、モデルの選択やプロンプトの生成には関与しない。
この分離により、将来モデルをクラウド LLM に差し替えても、エージェント側の変更は不要になる。

## 全体構成

```text
Mac                                Windows (RTX 5080)
─────────────────────────          ──────────────────────────────
Claude Code ──┐                    WSL2 (Ubuntu)
              │                      └ Docker Engine + Compose
Codex ────────┼─→ ai-review CLI        ├─ ai-api  :8080  ← LAN に公開
              │                        └─ ollama  :11434 ← 非公開
shell ────────┘
```

コンポーネントの責務は次のように分ける。

- **contract**：Request と Response の型、および JSON Schema。api と cli の双方が依存する唯一の正。
- **ai-api**：AI ロジックだけを持つ。プロンプト生成、モデル選択、結果整形。リポジトリの知識をゼロにする。
- **ai-review CLI**：git とファイルシステムの知識だけを持つ。文脈の収集と結果の表示。AI の知識をゼロにする。
- **ollama**：推論とモデル管理のみ。

この境界が守られていれば、モデルを差し替えても CLI は無傷で済み、リポジトリの構造が変わっても api は無傷で済む。

### リポジトリ構成

```text
exocortex/
├── docker-compose.yml
├── .env.example
├── packages/
│   └── contract/           # 型 + JSON Schema
├── apps/
│   ├── api/                # Hono + Node (WSL2 上で動く)
│   │   ├── Dockerfile
│   │   ├── src/
│   │   └── prompts/
│   └── cli/                # ai-review CLI (Mac 上で動く)
└── docs/
    ├── design.md           # このファイル
    └── setup-windows.md    # Windows セットアップの runbook
```

Claude Code の skill はこのリポジトリに含めない。
skill は全リポジトリ横断で使う個人設定であり、特定プロダクトの持ち物ではないため、dotfiles 側で `~/.claude/skills/ai-review/` として管理する。
skill の中身は CLI を呼ぶだけの薄いものにして、CLI 側の変更で壊れないようにする。

実装言語は api と cli の両方で TypeScript とする。
Request と Response の型を共有できることを優先した。

## モデル構成と VRAM 予算

RTX 5080 の VRAM は 16GB である。
この制約が設計の多くを決めている。

| 用途 | モデル | サイズ |
|---|---|---|
| コードレビュー | `qwen2.5-coder:14b` (q4_K_M) | 8.37 GiB |
| 日英翻訳 | `translategemma:12b` | 8.1 GB |

両者を同時に常駐させることはできない。
`OLLAMA_MAX_LOADED_MODELS=1` とし、用途をまたぐたびにモデルの切り替えが発生することを受け入れる。
レビューと翻訳を同時に使う場面は想定していない。

企画段階では `qwen3-coder:14b` を想定していたが、このタグは存在しない。
qwen3-coder は 30b (19GB) と 480b の 2 系統のみで、いずれも 16GB には収まらない。

### context 長と KV cache

Ollama の既定の context 長は VRAM 24GiB 未満の環境では 4K トークンしかない[^ctx]。
放置すると diff すら入らないため、`OLLAMA_CONTEXT_LENGTH` の明示指定が必須である。

`qwen2.5-coder:14b` の `max_position_embeddings` は 32768 なので、32K が上限となる。
このとき KV cache の大きさは次のようになる。

```
KV cache bytes = 2 * num_layers * num_kv_heads * head_dim * seq_len * bytes_per_element
               = 2 * 48 * 8 * 128 * 32768 * bytes_per_element
```

| 構成 | KV cache | 重みとの合計 |
|---|---|---|
| 32K + f16（既定） | 6.00 GiB | 14.4 GiB |
| 32K + q8_0 | 3.19 GiB | 11.6 GiB |
| 16K + f16 | 3.00 GiB | 11.4 GiB |

f16 のまま 32K を確保すると、16GB に対して残りが 1.6 GiB しかなく、compute buffer を含めると成立しない可能性が高い。

**32K + q8_0 を採用する。**
`OLLAMA_FLASH_ATTENTION=1` と `OLLAMA_KV_CACHE_TYPE=q8_0` を設定する。
KV cache の量子化には Flash Attention の有効化が必要である[^kv]。

16K + f16 との比較では、メモリ消費がほぼ等しい。
つまりこれは節約の選択ではなく、同じ予算で context の長さと KV cache の精度のどちらを買うかの選択である。
context が足りない場合、モデルは該当のコードを物理的に見られず、指摘は原理的に出ない。
KV cache の精度低下は出力の質を下げるが、情報そのものは残る。
欠落と質の低下では前者のほうが致命的なので、context を優先する。

ただし Ollama の FAQ は、GQA 比の高いモデルほど KV cache の量子化による精度低下が大きい可能性があると注意しており、`qwen2.5-coder:14b` は 40 heads / 8 KV heads の 5:1 でこの注意の対象にあたる。
レビュー品質に不満が出た場合は、16K + f16 と、`qwen2.5-coder:7b` + 32K + f16 を実測で比較する。
環境変数の変更とコンテナ再起動だけで移行できるため、この判断はやり直しが利く。

[^ctx]: [Context length - Ollama Docs](https://docs.ollama.com/context-length.md)

[^kv]: [FAQ - Ollama Docs](https://docs.ollama.com/faq)

## API 仕様

外部に公開するのは ai-api だけである。
認証は `Authorization: Bearer <token>` による共有シークレット 1 本とする。

### POST /review

```jsonc
{
  "language": "typescript",
  "diff": "diff --git a/src/foo.ts ...",
  "rules": ["Clean Architecture", "No Side Effects"],
  "context": {
    "files": [{ "path": "src/foo.ts", "content": "..." }]
  }
}
```

```jsonc
{
  "summary": "...",
  "comments": [
    { "severity": "major", "file": "src/foo.ts", "line": 42, "message": "..." }
  ],
  "meta": { "model": "qwen2.5-coder:14b", "inputTokens": 12043, "durationMs": 18234 }
}
```

`severity` は `critical` / `major` / `minor` / `info` の 4 値に固定する。
`comments[]` には `file` を持たせる。
diff は複数ファイルにまたがるため、`line` だけでは指摘箇所を特定できない。

出力の構造は Ollama の structured outputs で強制する。
`format` に JSON Schema オブジェクトを渡すと、その構造での出力が保証される[^so]。
あわせて `temperature: 0` を指定する。
公式ドキュメントが構造化出力での推奨として明記している。

[^so]: [Structured outputs - Ollama Docs](https://docs.ollama.com/capabilities/structured-outputs)

### POST /translate

```jsonc
{ "text": "...", "from": "ja", "to": "en" }
// → { "text": "..." }
```

translategemma は system prompt が機能しない。
Ollama の TEMPLATE が system role を user role と同一のブロックに畳むためである。
公式が指定する英文テンプレートを user メッセージ 1 通に組み立てる必要があり、訳文本文の直前に空行を 2 つ置くという指定まで含む[^tg]。

この癖の吸収は ai-api の責務に閉じ込め、CLI 側には見せない。
出力は平文なので structured outputs は使わない。

[^tg]: [translategemma - Ollama Library](https://ollama.com/library/translategemma)

### context 超過時の扱い

送られた `context.files` の推定トークン数が上限を超える場合、ai-api は 413 を返す。
どのファイルで超過したかをレスポンスに含め、CLI がファイルを削って再送できるようにする。

黙って切り詰める方式は採らない。
レビュー結果が理由もなく浅くなり、再現しにくい不具合になるためである。

## ai-review CLI

CLI の仕事は、git とファイルシステムの知識だけを使って 32K に収まる文脈を組むことである。

```bash
ai-review                    # 未コミットの変更をレビュー
ai-review --base main        # main からの差分をレビュー
ai-review --staged           # ステージ済みのみ
ai-review --json             # 機械可読出力（skill から使う）
```

### 文脈の収集

優先度の高いものから詰め、上限に達したところで打ち切る。

| 優先度 | 内容 | 意図 |
|---|---|---|
| 1 | diff 本体 | これが無ければレビューが成立しない |
| 2 | 変更ファイルの現在の全文 | diff だけでは前後の文脈と型が見えない |
| 3 | プロジェクト規約 | `CLAUDE.md` / `AGENTS.md` / lint 設定 |
| 4 | 関連する設計ドキュメント | 設計意図に反する実装を検出するため |
| 5 | 変更ファイルを import している側 | 変更が壊す先を見るため |
| 6 | 変更ファイルが import している側 | 型定義とシグネチャを見るため |

設計ドキュメントを importer より上に置いたのは、役割が違うからである。
importer は変更が何を壊すかを見せるが、設計ドキュメントはそのコードがどうあるべきかを語る。
後者がなければ、動くけれども設計意図に反しているという種類の指摘は出ない。

importer を import 先より上に置いたのは、壊れるのが常に呼び出し元だからである。
片方しか入らないなら、importer を残すほうが実害のある指摘が出る。

### 関連ファイルの解決

import 文の抽出と、その逆引きの両方を `rg` で行う。

TypeScript Compiler API を使えば path alias や re-export まで正確に追えるが、TS 専用になり、大きなリポジトリでは起動が遅い。
正規表現による抽出は取りこぼしを生むものの、TS と JS では実用上十分で、他言語への拡張も容易である。

設計ドキュメントの探索にも同じ逆引きを使う。
変更ファイル名、ディレクトリ名、export されたシンボル名を `*.md` から検索し、言及しているドキュメントを拾う。

### トークン数の見積もり

文字数からの概算とする。

tokenizer を CLI に持ち込むと依存が重くなる。
超過した場合は 413 が返って削り直せるため、見積もりの精度に見合わない。

## Docker 構成

```yaml
services:
  ollama:
    image: ollama/ollama
    # ports を書かない。これが「外部非公開」の保証になる
    volumes: [ollama:/root/.ollama]
    environment:
      OLLAMA_CONTEXT_LENGTH: 32768
      OLLAMA_MAX_LOADED_MODELS: 1
      OLLAMA_FLASH_ATTENTION: 1
      OLLAMA_KV_CACHE_TYPE: q8_0
      OLLAMA_KEEP_ALIVE: 30m

  ai-api:
    build: ./apps/api
    ports: ["8080:8080"]
    environment:
      OLLAMA_URL: http://ollama:11434
      API_TOKEN: ${API_TOKEN}
    depends_on: [ollama]

volumes: { ollama: }
```

`ollama` に `ports:` を書かないことが要点である。
Ollama を外部に公開しないという方針を、運用上の注意ではなく compose の構造で保証できる。
同一ネットワーク内の `ai-api` からは `http://ollama:11434` で到達する。

GPU の割り当ては nvidia-container-toolkit の設定に従う。

## Windows セットアップ

詳細な手順は `setup-windows.md` に置く。
ここでは踏みやすい落とし穴だけを記す。

WSL2 は既定で NAT モードのため、Mac から一切到達できない[^wsl]。
Windows 11 22H2 以降であれば `.wslconfig` の `[wsl2]` に `networkingMode=mirrored` を設定する。
あわせて Hyper-V ファイアウォールの受信許可が必要になる。

```powershell
Set-NetFirewallHyperVVMSetting -Name '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}' -DefaultInboundAction Allow
```

`ai-api` は `127.0.0.1` ではなく `0.0.0.0` にバインドする。

RTX 5080 は Ollama の公式サポート対象である（compute capability 12.0）。
ドライバは 550 以降が必要になる。

[^wsl]: [Accessing network applications with WSL - Microsoft Learn](https://learn.microsoft.com/en-us/windows/wsl/networking)

## エラー処理

CLI が次の行動を選べる粒度で返す。

| 状況 | HTTP | CLI の振る舞い |
|---|---|---|
| token 不一致 | 401 | 設定の確認を促して終了 |
| リクエスト不正 | 400 | バグとして詳細を表示 |
| context 超過 | 413 | 超過したファイル名を見て削り、再送 |
| Ollama 到達不可 | 503 | Windows 機が起動しているかを示唆 |
| 推論タイムアウト | 504 | リトライを促す |

`OLLAMA_MAX_LOADED_MODELS=1` のため、review と translate を交互に使うとモデルのロードが挟まる。
この初回レイテンシを異常と誤認しないよう、タイムアウトは長めに取り、`meta` にロード時間を含めて可視化する。

## テスト方針

実 GPU なしで回せる範囲を最大化する。

- **contract**：JSON Schema と型の往復を検証する。
- **api**：Ollama を HTTP モックし、プロンプト生成と結果整形を検証する。translategemma の空行 2 つのような癖はここで固定する。
- **cli**：一時 git リポジトリを作り、diff 収集、優先度による詰め、413 を受けた後の再送を検証する。
- **e2e**：実機がある場合のみ実行する。CI では動かさない。

実装は TDD で進める。

## 採用しなかった案

**リポジトリ全体をレビューに渡す。**
`qwen2.5-coder:14b` の context 上限は 32K トークンで、ソースコードにして約 100KB にあたる。
中規模のリポジトリでも桁が合わない。
加えて、無関係なコードを大量に入れると注意が拡散し、指摘が浅くなる傾向がある。

**サーバー側にリポジトリを同期する。**
AI ロジックを完全に API へ集約できるが、同期と認証の仕組みが必要になり、ai-api が stateless でなくなる。
Mac 側には git と `rg` が揃っているため、文脈の収集を Mac 側で行えばこの複雑さを回避できる。

**Embedding と Vector DB による検索。**
精度は最も高くなりうるが、初期スコープに対して構築コストが見合わない。
将来の拡張候補として残す。

**MCP server として実装する。**
エージェントが自律的に呼べる利点はあるが、実装と検証のコストが最も高い。
CLI であれば Claude Code、Codex、手打ちのシェルのいずれからも同じものが使える。

## 未検証事項

以下は一次ソースで確認できていない。
実装や運用の中で確かめる。

- q8_0 の KV cache がレビュー品質に与える影響。実測が必要である。
- structured outputs がモデルの `tools` capability を要求するかどうか。Ollama の公式ドキュメントに記載がない。`qwen2.5-coder:14b` は `tools` に対応しているため、当面は問題にならない。
- WSL2 上の Docker コンテナが公開したポートについて、mirrored モードでの到達性。Microsoft の文書は WSL2 一般の記述にとどまり、Docker を挟んだ場合の記載がない。
- `translategemma:12b` の日英翻訳の実際の品質。

## 今後の拡張候補

- `POST /summarize`、`POST /design-review`、`POST /generate-tests`
- LiteLLM によるクラウド LLM へのフォールバック
- Open WebUI
- Embedding と Vector DB
