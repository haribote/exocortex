# exocortex

自宅の Windows マシン (RTX 5080) をローカル LLM 推論サーバーとして動かし、Mac の開発環境から HTTP 経由でコードレビューや翻訳を依頼する仕組みです。

## 名前の由来

**exocortex** は `exo-`（外部）と `cortex`（大脳皮質）を組み合わせた語で、脳の外側にあって高次の思考を助ける情報処理システムを指します[^wiktionary]。
提唱者は Ben Houston で、1999 年後期に造語しました[^houston]。
日本語で近い概念を探すなら、攻殻機動隊の「電脳」（公式英訳は cyberbrain）があたります[^ig]。

この名前は構成の説明でもあります。
Mac 上で動くエージェントは推論能力を持たず、LAN の向こうにある GPU に演算を委ねます。
思考の実体が身体の外部にあるという語義が、そのまま設計に対応しています。

[^wiktionary]: [exocortex - Wiktionary](https://en.wiktionary.org/wiki/exocortex)

[^houston]: Ben Houston, [Origins of the Term Exocortex](https://ben3d.ca/blog/origins-of-the-term-exocortex)

[^ig]: Production I.G [用語集「電脳 Cyberbrains」](https://www.production-ig.co.jp/works/ghost-in-the-shell-sac/vocab/01.html)

## 動作環境

```text
Mac                                Windows (RTX 5080)
─────────────────────────          ──────────────────────────────
Claude Code ──┐                    WSL2
              │  SSH トンネル        └ Docker Engine + Compose
Codex ────────┼─→ curl (skill) ─────→ ├─ ai-api  :11435 ← loopback のみ
              │                        └─ ollama  :11434 ← 非公開
shell ────────┘
```

Mac 側はリポジトリの snapshot を tar して送るだけで、Windows 側の API が diff の算出、関連ファイルの収集、プロンプトの生成、推論、結果の整形を担います。
クライアントは配布物を持たず、skill と手打ちシェルが固定のレシピ（tar と curl）を実行します。
`ai-api` は Windows の loopback にだけ publish し、Mac からは SSH トンネル越しに叩きます。
Ollama は推論だけを担当し、`ai-api` からしか到達できません。

### サーバー側（Windows）

| 項目 | 要件 |
|---|---|
| GPU | NVIDIA 製、VRAM 16GB 以上（想定は RTX 5080） |
| Windows | 11 22H2 以降 |
| WSL2 | Docker Engine + Compose を動かすディストロ |
| モデル | `qwen3:14b`（コードレビュー）、`translategemma:12b`（日英翻訳） |

VRAM 16GB では両方のモデルを同時に常駐させられないため、Ollama 側で用途ごとに切り替えます。

### クライアント側（Mac）

| 項目 | 要件 |
|---|---|
| SSH | exocortex 専用の鍵ペアと `~/.ssh/config` のエイリアス |
| コマンド | `git`、`tar`、`curl`、`jq` |
| Claude Code skill | `exoc-review`、`exoc-translate`（dotfiles 側で管理し、この repo には含まれない） |

## ドキュメント

- [Get started](docs/get-started.md)：サーバーとクライアントのセットアップガイド
- [How to use](docs/how-to-use.md)：skill を通じた使い方ガイド
- [API reference](docs/api-reference.md)：HTTP 契約とクライアントのレシピ
