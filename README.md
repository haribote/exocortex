# exocortex

自宅の Windows マシン (RTX 5080) をローカル LLM 推論サーバーとして動かし、Mac の開発環境から HTTP 経由でコードレビューや翻訳を依頼するための仕組みです。

現在は設計段階で、実装はまだありません。

## 名前の由来

**exocortex** は `exo-`（外部）と `cortex`（大脳皮質）を組み合わせた語で、脳の外側にあって高次の思考を助ける情報処理システムを指します[^wiktionary]。

提唱者は Ben Houston です。
本人の記述によれば、認知科学を専攻する学部生だった 1999 年後期に造語し、2000 年に「an organ outside the brain that aids in high-level thinking」という定義を公開しました[^houston]。
「1998 年 11 月に提唱された」とする記述が各所に流通していますが、本人の説明と食い違っており、その日付を裏付ける一次ソースは確認できていません。

日本語で近い概念を探すなら、攻殻機動隊の「電脳」があたります。
「電脳」の公式英訳は cyberbrain です[^ig]。

この名前は構成の説明でもあります。
Mac 上で動くエージェントは推論能力を持たず、LAN の向こうにある GPU に演算を委ねます。
思考の実体が身体の外部にあるという語義が、そのまま設計に対応しています。

[^wiktionary]: [exocortex - Wiktionary](https://en.wiktionary.org/wiki/exocortex)

[^houston]: Ben Houston, [Origins of the Term Exocortex](https://ben3d.ca/blog/origins-of-the-term-exocortex)

[^ig]: Production I.G [用語集「電脳 Cyberbrains」](https://www.production-ig.co.jp/works/ghost-in-the-shell-sac/vocab/01.html)

## 構成

```text
Mac                                Windows (RTX 5080)
─────────────────────────          ──────────────────────────────
Claude Code ──┐                    WSL2 "exocortex" (D:\wsl\exocortex)
              │  snapshot を tar     └ Docker Engine + Compose
Codex ────────┼─→ curl (skill) ─────→ ├─ ai-api  :11435 ← LAN に公開
              │                        └─ ollama  :11434 ← 非公開
shell ────────┘
                                   ComfyUI (Windows native) ← GPU を共有
```

Mac 側はリポジトリの snapshot を tar して送るだけで、Windows 側の API が diff の算出、関連ファイルの収集、プロンプトの生成、推論、結果の整形を担います。
クライアントは配布物を持たず、skill と手打ちシェルが固定のレシピ（tar と curl）を実行します。
Ollama は推論だけを担当し、LAN には公開しません。

モデルは用途ごとに使い分けます。
コードレビューには `qwen3:14b`、日英翻訳には `translategemma:12b` を使います。
VRAM 16GB では両方を同時に常駐させられないため、Ollama 側でモデルを切り替えます。
