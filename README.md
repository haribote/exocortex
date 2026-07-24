# exocortex

ゲーミング PC など、比較的高性能な GPU を搭載した Windows マシンをローカル LLM 推論サーバーとして動かし、LAN 内の他の開発環境から HTTP 経由でコードレビューや翻訳を依頼する仕組み。

## 名前の由来

**exocortex** は `exo-`（外部）と `cortex`（大脳皮質）を組み合わせた語で、脳の外側にあって高次の思考を助ける情報処理システムを指す造語である。 [^wiktionary] [^houston]

手元の開発環境とは別に、LAN の向こうにある GPU に推論を委ねる。
思考の実体が身体の外部にある。
攻殻機動隊の「電脳」、それも自身の体とは切り離された「外部硬電脳」のイメージ。

[^wiktionary]: [exocortex - Wiktionary](https://en.wiktionary.org/wiki/exocortex)

[^houston]: Ben Houston, [Origins of the Term Exocortex](https://ben3d.ca/blog/origins-of-the-term-exocortex)

## 動作環境

```text
クライアント                       サーバー (Windows)
─────────────────────────          ──────────────────────────────
Claude Code ──┐                    WSL2
              │  SSH トンネル        └ Docker Engine + Compose
Codex ────────┼─→ curl (skill) ─────→ ├─ ai-api  :11435 ← loopback のみ
              │                        └─ ollama  :11434 ← 非公開
shell ────────┘
```

クライアントからは SSH トンネルで ai-api を呼び出す。
サーバーでは ai-api が Ollama に推論を要求し、その結果をクライアントに返す。

また、これらの操作は skill で行うことで、 AI が AI を呼び出して、またその結果を受け取ることが可能となっている。

### サーバー側（Windows）

| 項目    | 要件                                                            | 動作確認環境 |
| ------- | --------------------------------------------------------------- | ------------ |
| GPU     | NVIDIA 製、VRAM 16GB 以上                                       | RTX 5080     |
| Windows | 11 22H2 以降                                                    |              |
| WSL2    | Docker Engine + Compose を動かすディストロ                      | Ubuntu       |
| モデル  | `qwen3:14b`（コードレビュー）、`translategemma:12b`（日英翻訳） |              |

VRAM 16GB では両方のモデルを同時に常駐させられないため、Ollama 側で用途ごとに切り替る。

### クライアント側

| 項目              | 要件                                                  |
| ----------------- | ----------------------------------------------------- |
| SSH               | exocortex 専用の鍵ペアと `~/.ssh/config` のエイリアス |
| コマンド          | `git`, `tar`, `curl`, `jq`                            |
| Claude Code skill | `exoc-review`, `exoc-translate`                       |

## ドキュメント

- [Get started](docs/get-started.md)：サーバーとクライアントのセットアップガイド
- [How to use](docs/how-to-use.md)：skill を通じた使い方ガイド
- [API reference](docs/api-reference.md)
