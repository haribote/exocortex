# 設計

## 目的

自宅の Windows マシン (RTX 5080) をローカル LLM 推論サーバーとして動かし、Mac の開発環境から HTTP 経由でコードレビューと日英翻訳を依頼する。

初期スコープは 2 つのエンドポイントに絞る。
git diff のレビューと、日英翻訳である。

エージェント（Claude Code、Codex）はローカル LLM の存在を直接知らない。
Mac 上の薄いレシピ（skill が実行する tar と curl）を呼ぶだけで、モデルの選択もプロンプトの生成も、文脈の選別にも関与しない。
これらはすべてサーバー側にある。
この分離により、将来モデルをクラウド LLM に差し替えても、クライアント側の変更は要らない。
クライアントが送るのはリポジトリの snapshot だけで、その形はモデルにも言語にも依存しないためである。

## 全体構成

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

コンポーネントの責務は次のように分ける。

- **contract**：Request と Response の型、および JSON Schema。唯一の正。消費者は ai-api だけ。
- **ai-api**：snapshot の展開、git diff、関連ファイル解決、context 選別、プロンプト生成、モデル選択、結果整形。リポジトリの知識を持つ。
- **クライアント**：リポジトリの snapshot を tar して POST するレシピ。配布物を持たず、skill と手打ちシェルが実行する。AI の知識をゼロにする。
- **ollama**：推論とモデル管理のみ。

この境界により、モデルを差し替えてもクライアントは無傷で済む。
クライアントが送る snapshot はモデルにも言語にも依存しない固定の形だからである。
代償として、リポジトリの構造や対応言語が変わると ai-api を直すことになる。
賢さをサーバー 1 箇所に集めた選択であり、複数のクライアントを更新して回るより、この 1 箇所を直すほうが軽い。

### リポジトリ構成

```text
exocortex/
├── docker-compose.yml
├── .env.example
├── packages/
│   └── contract/           # 型 + JSON Schema
├── apps/
│   └── api/                # Hono + Node (WSL2 上で動く)
│       ├── Dockerfile
│       ├── src/
│       └── prompts/
└── docs/
    ├── design.md           # このファイル
    ├── api-usage.md        # HTTP 契約とクライアントのレシピ
    └── setup-windows.md    # Windows セットアップの runbook
```

クライアントはこのリポジトリに配布物を持たない。
`/review` は「作業ツリーと `.git` を tar して POST するレシピ」、`/translate` は `curl` の直接呼び出しで、いずれも Claude Code の skill が実行する。
skill は全リポジトリ横断で使う個人設定であり、特定プロダクトの持ち物ではないため、dotfiles 側で `~/.claude/skills/exoc-review/` と `~/.claude/skills/exoc-translate/` として管理する。
skill の中身はレシピを実行するだけの薄いものにして、サーバー側の変更で壊れないようにする。

実装言語は TypeScript とする。
Request と Response の型を contract で共有できることを優先した。

## モデル構成と VRAM 予算

RTX 5080 の VRAM は 16GB である。
この制約が設計の多くを決めている。

| 用途 | モデル | サイズ |
|---|---|---|
| コードレビュー | `qwen3:14b` (q4_K_M) | 約 8.7 GiB |
| 日英翻訳 | `translategemma:12b` | 8.1 GB |

両者を同時に常駐させることはできない。
`OLLAMA_MAX_LOADED_MODELS=1` とし、用途をまたぐたびにモデルの切り替えが発生することを受け入れる。
レビューと翻訳を同時に使う場面は想定していない。

### レビューモデルの選定

当初は `qwen2.5-coder:14b` を使っていた。
コーディング特化のモデルなら、コードレビューに向くだろうという見込みである。
企画段階で候補にした `qwen3-coder:14b` はタグ自体が存在せず、qwen3-coder は 30b (19GB) と 480b の 2 系統のみで 16GB に収まらないため、コーディング特化の qwen3 は選べなかった。

しかし実測すると、`qwen2.5-coder:14b` はレビューに使えなかった。
実在しないコードを幻視し、diff の中間状態を最終状態と取り違え、存在しない重複を報告した。
3 回の測定で、採用できた指摘は一つも無い。

コーディング特化ではない汎用の `qwen3:14b` に切り替えたところ、この問題が解消した。
意図的に仕込んだ 3 種のバグ（単一行の論理反転、データフローを追う必要のある誤り、プロジェクト規約の違反）を、いずれも行番号と引用まで正確に検出した。
`qwen2.5-coder:14b` が同じ 3 問で 1 つしか捕まえられなかったのと対照的である。

差を生んだのは thinking mode だと見ている。
レビューは、値がどこから来てどこへ渡るか、規約が目の前のコードに適用されるかといった多段の推論を要する。
コード生成の巧拙よりも、この推論の質が効く。
`qwen3:14b` は応答の前に思考を挟み、その思考は `message.thinking` に分離されて構造化出力を壊さない。

代償は速度である（「実測値」を参照）。
このツールに求めるのは、速く返すことではなく、誤りを載せないことだと判断した。
誤検出を検証する手間がレビューの価値を上回るなら、速くても意味がない。

### context 長と KV cache

Ollama の既定の context 長は VRAM 24GiB 未満の環境では 4K トークンしかない[^ctx]。
放置すると diff すら入らないため、`OLLAMA_CONTEXT_LENGTH` の明示指定が必須である。

`qwen3:14b` は native で 32768 トークンの context を持つ（config 上は reasoning 用に 8192 を足した 40960、YaRN で 131072 まで拡張可能）。
32K は native の範囲に収まるため、`qwen2.5-coder:14b` で 32K が上限ぎりぎりだったのに比べ、余裕がある。
このとき KV cache の大きさは次のようになる。

```
KV cache bytes = 2 * num_layers * num_kv_heads * head_dim * seq_len * bytes_per_element
               = 2 * 40 * 8 * 128 * 32768 * bytes_per_element
```

| 構成 | KV cache | 重みとの合計 |
|---|---|---|
| 32K + f16（既定） | 5.00 GiB | 13.7 GiB |
| 32K + q8_0 | 2.50 GiB | 11.2 GiB |
| 16K + f16 | 2.50 GiB | 11.2 GiB |

`qwen3:14b` は 40 層で、`qwen2.5-coder:14b` の 48 層より KV cache が小さい。
上表は計算値であり、`ollama ps` での実測はしていない。

f16 のまま 32K を確保すると、16GB に対して残りが 2.3 GiB しかなく、compute buffer を含めると成立しない可能性が高い。

**32K + q8_0 を採用する。**
`OLLAMA_FLASH_ATTENTION=1` と `OLLAMA_KV_CACHE_TYPE=q8_0` を設定する。
KV cache の量子化には Flash Attention の有効化が必要である[^kv]。

16K + f16 との比較では、メモリ消費がほぼ等しい。
つまりこれは節約の選択ではなく、同じ予算で context の長さと KV cache の精度のどちらを買うかの選択である。
context が足りない場合、モデルは該当のコードを物理的に見られず、指摘は原理的に出ない。
KV cache の精度低下は出力の質を下げるが、情報そのものは残る。
欠落と質の低下では前者のほうが致命的なので、context を優先する。

ただし Ollama の FAQ は、GQA 比の高いモデルほど KV cache の量子化による精度低下が大きい可能性があると注意しており、`qwen3:14b` は 40 heads / 8 KV heads の 5:1 でこの注意の対象にあたる。
16K + f16 との比較では KV cache がどちらも 2.5 GiB でメモリ消費が等しく、精度が疑わしくなれば `OLLAMA_KV_CACHE_TYPE` を外して 16K + f16 に移せる。
環境変数の変更とコンテナ再起動だけで移行できるため、この判断はやり直しが利く。

[^ctx]: [Context length - Ollama Docs](https://docs.ollama.com/context-length.md)

[^kv]: [FAQ - Ollama Docs](https://docs.ollama.com/faq)

### GPU の共有

この GPU は ComfyUI と共有する。
ComfyUI は Windows ネイティブで動かすため、WSL2 側の Ollama とは互いの VRAM 使用を知らない。

両者のモデルを同時に載せることはできない。
qwen3 の重みと KV cache で約 11.2 GiB を使うため、残りは 4.8 GiB しかなく、compute buffer を引けばさらに減る。
SDXL 級のモデルはここに収まらない。

競合したとき、どちらもエラーで停止しない。
Ollama は載らない分を CPU にオフロードし、ComfyUI は Windows の NVIDIA ドライバが既定で system memory へのフォールバックを許す。
結果として、失敗ではなく「なぜか遅い」という形で現れる。
このため `ollama ps` の `PROCESSOR` 列の確認は、セットアップ時の一度きりではなく日常の診断手段として位置づける。

`OLLAMA_KEEP_ALIVE` は `5m` とする。
VRAM を占有するのはプロセスの起動中ではなくモデルのロード中だけなので、この値が実質的な共有の調停になる。
レビュー、修正、再レビューという連続した操作は数分間隔で起きるためモデルは常駐したままになり、席を立てば解放される。
30m では、レビューを投げた 20 分後に ComfyUI を開くという何気ない操作で衝突する。
行き来の頻度が低いことと、衝突しないことは別の話である。

代償はモデルの再ロードである。
モデルを D: の NVMe に置くことで軽くなると見込んでいたが、実測では約 30 秒かかった（「実測値」を参照）。
席を立って戻るたびに、この待ちが 1 回入る。

両者が自動で VRAM を譲り合う調停は作らない。
`OLLAMA_KEEP_ALIVE` の変更とコンテナの再起動だけでやり直せる範囲に、判断を留めておく。

## モデルとデータの保存先

Ollama のモデルは 2 本で 16GB を超える。
Docker のイメージとビルドキャッシュも加わるため、これらを C: に置かない。

**exocortex 専用の WSL ディストリビューションを D: に新設する。**

```powershell
wsl --install -d Ubuntu --location D:\wsl\exocortex --name exocortex
```

D: は PCIe Gen4 x4 の NVMe で、Windows のファイル置き場として使用中である。
この方式なら D: は NTFS のまま変わらず、増えるのは `ext4.vhdx` というファイルが 1 つだけになる。
パーティションの操作は発生しない。

Docker のデータルート、イメージ、Ollama の named volume がすべてこのディストロの中に載るため、`docker-compose.yml` に保存先の記述は要らない。
named volume のまま書けばよい。

### この方式を選んだ理由

検討した案は 3 つある。

**D: を丸ごと WSL2 に明け渡す**（`wsl --mount --bare`）。
最も速いが、そのドライブは Windows から見えなくなる。
D: には既存のデータがあるため成立しない。

**D: 上に `models.vhdx` を置き、モデルだけを分離する**（`wsl --mount --vhd`）。
モデルを WSL 環境から切り離して管理できる利点がある。
しかし公式ドキュメントに手順が無い操作を 4 つ積むことになる。
VHDX の新規作成、ext4 でのフォーマット、再起動後の再マウント、そして容量の回収である。

とくに永続性が問題になる。
`wsl --mount` によるマウントは WSL のシャットダウンで失われ、公式に推奨される永続化の手順が存在しない。
マウントし忘れた状態で `docker compose up` すると Docker は空のディレクトリを作り、Ollama はモデルが無いと判断して再ダウンロードを始める。
16GB が静かに消えて静かに落ちてくる、気づきにくい事故になる。

**専用ディストロを新設する**（採用）。
`wsl --install --location` は公式に文書化されており、再マウントの問題が起きない。
既存の WSL 環境に一切触れないため、失敗しても `wsl --unregister` でやり直せる。
既存ディストロを `wsl --export` して移設する案も考えたが、`wsl --unregister` を伴うため既存環境を失うリスクがある。
新設ならそのリスクが無い。

引き換えに、Docker Engine と nvidia-container-toolkit をこのディストロに導入する必要がある。
ただしこれは `setup-windows.md` の手順に元から含まれており、追加の作業は生じない。

`.wslconfig` の `memory` と `processors` は WSL2 の VM 全体に効く設定であり、ディストロごとに分ける手段は無い[^wslcfg]。
既存のディストロと同時に動かせばメモリを取り合う。

[^wslcfg]: [Advanced settings configuration in WSL - Microsoft Learn](https://learn.microsoft.com/en-us/windows/wsl/wsl-config)

## API 仕様

外部に公開するのは ai-api だけである。
認証は `Authorization: Bearer <token>` による共有シークレット 1 本とする。

ポートは 11435 とする。
Ollama の 11434 の隣に置くことで、番号から用途が分かる。
8080 を避けたのは、mirrored networking mode では WSL2 と Windows がポート空間を共有するためである。
Windows 側で 8080 を使うものがあれば、そのまま衝突する。
49152 以降は Windows の ephemeral port range にあたるため、この範囲も使わない。
コンテナの内と外で同じ番号を使い、`curl` とログで番号が食い違わないようにする。

### POST /review

リクエストは `multipart/form-data` で、リポジトリの snapshot と少数のパラメータを送る。
diff や context の中身はここに載せない。
それらはサーバーが snapshot から自分で組む。

- **params**：JSON。`{ "language": string, "base"?: string, "staged"?: boolean, "rules"?: string[] }`。
- **snapshot**：tar.gz。作業ツリー（tracked と非 ignore の untracked）に `.git` を加えたもの。

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

`severity` は `critical` / `major` / `minor` / `info` の 4 値に固定する。
`comments[]` には `file` を持たせる。
diff は複数ファイルにまたがるため、`line` だけでは指摘箇所を特定できない。
リクエストとレシピの詳細は `api-usage.md` にある。

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

この癖の吸収は ai-api の責務に閉じ込め、クライアント側には見せない。
出力は平文なので structured outputs は使わない。

[^tg]: [translategemma - Ollama Library](https://ollama.com/library/translategemma)

### context 超過時の扱い

context の選別はサーバーの中で完結する。
ai-api は優先度の高いものから予算内に詰め、収まらないファイルを落とす。
落とした数は `meta.droppedContextFiles` でクライアントに返す。
クライアントからの再送は無い。

黙って切り詰めるのとは違う。
何を落としたかを `meta` で可視化し、優先度の低い context から順に落とすため、レビュー結果が理由もなく浅くなることはない。

diff 本体だけは落とせない。
diff 単体の推定トークン数が予算を超える場合に限り、ai-api は 413 を返す。

## クライアント

クライアントは配布物を持たない。
`/review` は「作業ツリーと `.git` を tar して multipart で POST する」固定のレシピで、`/translate` は JSON を直接 POST する `curl` である。
どちらも Claude Code の skill が実行し、手打ちのシェルからも同じレシピが使える。

このレシピはモデルにも言語にも repo の構造にも依存しない。
`base`（main からの差分）や `staged`（ステージ済みのみ）といった指定は params に載せるだけで、分岐の解釈はサーバーが持つ。
翻訳は文脈を組まない。
入力は利用者が渡すテキストそのものであり、リポジトリから集めるものが無い。
`from` と `to` は必須とし、翻訳方向を推測しない。
言語を取り違えたまま訳文が返ると、利用者はそれが逆方向の結果だと気付きにくい。

CLI を配布物として持つ案は採らない。
レシピに残る仕事は tar と POST だけで、モデルや言語に依存しない固定の形である。
賢さをサーバーに寄せた動機がこの部分には効かないため、ビルドと配布を負う CLI の形を保つ意味が無い。
レシピと HTTP 契約の詳細は `api-usage.md` にある。

## サーバー側の文脈収集

ai-api は snapshot を隔離した一時ディレクトリに展開し、そこで context を組む。
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

import 文の抽出と、その逆引きの双方を正規表現で行う。

TypeScript Compiler API を使えば path alias や re-export まで正確に追えるが、TS 専用になり、大きなリポジトリでは起動が遅い。
正規表現による抽出は取りこぼしを生むものの、TS と JS では実用上十分で、他言語への拡張も容易である。

逆引きはリポジトリ全体を走査するため `rg` を使う。
変更ファイル自身からの import 抽出は、内容がすでに手元にあるので直接読んで正規表現をかける。
ここで `rg` を起動しても、プロセスを 1 つ増やすだけで得るものがない。

設計ドキュメントの探索にも同じ逆引きを使う。
変更ファイル名、ディレクトリ名、export されたシンボル名を `*.md` から検索し、言及しているドキュメントを拾う。

### トークン数の見積もり

文字数からの概算とする。

tokenizer を持ち込むと依存が重くなる。
概算で予算内に詰め、収まらない context を優先度の低いものから落とすため、見積もりの精度に見合わない。

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
      OLLAMA_KEEP_ALIVE: 5m

  ai-api:
    build: ./apps/api
    ports: ["11435:11435"]
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

専用ディストロでは Docker のために systemd を有効にする。
`/etc/wsl.conf` の `[boot]` に `systemd=true` を書く。
WSL 0.67.6 以降が必要である[^systemd]。

`wsl --install` の `--location` は公式に文書化されているが、どのバージョンから使えるかの記載が無い。
手順の先頭で `wsl --version` を確認し、使えない場合は `wsl --import` に切り替える。

RTX 5080 は Ollama の公式サポート対象である（compute capability 12.0）。
ドライバは 550 以降が必要になる。

[^systemd]: [Use systemd to manage Linux services with WSL - Microsoft Learn](https://learn.microsoft.com/en-us/windows/wsl/systemd)

[^wsl]: [Accessing network applications with WSL - Microsoft Learn](https://learn.microsoft.com/en-us/windows/wsl/networking)

## エラー処理

クライアントが次の行動を選べる粒度で返す。

| 状況 | HTTP | 意味 |
|---|---|---|
| token 不一致 | 401 | 設定の確認を促す |
| リクエスト不正（params や snapshot の欠落、不正な base、展開失敗、差分なし） | 400 | バグまたは指定ミスとして詳細を表示 |
| snapshot 過大、または diff 単体が予算超過 | 413 | snapshot を減らすか差分を絞る |
| Ollama 到達不可 | 503 | Windows 機が起動しているかを示唆 |
| Ollama がエラーを返した | 502 | モデル名や Ollama 自体の状態を確認するよう示唆 |
| 推論タイムアウト | 504 | リトライを促す |

context の選別はサーバー内で完結するため、context 超過を理由とする再送は無い。

`OLLAMA_MAX_LOADED_MODELS=1` のため、review と translate を交互に使うとモデルのロードが挟まる。
この初回レイテンシを異常と誤認しないよう、タイムアウトは長めに取り、`meta` にロード時間を含めて可視化する。

## テスト方針

実 GPU なしで回せる範囲を最大化する。

- **contract**：JSON Schema と型の往復を検証する。
- **api**：Ollama を HTTP モックする。プロンプト生成と結果整形に加え、一時 git リポジトリを tar して snapshot の展開、diff の算出、関連解決、優先度による詰めを検証する。translategemma の空行 2 つのような癖はここで固定する。
- **クライアント**：固定レシピ（tar と curl）はこの repo で unit test しない。macOS の bsdtar での動作と multipart 送信は e2e と手動で確かめる。
- **e2e**：実機がある場合のみ実行する。CI では動かさない。

実装は TDD で進める。

## 採用しなかった案

**リポジトリ全体をモデルの context に入れる。**
`qwen3:14b` の context 上限は 32K トークンで、ソースコードにして約 100KB にあたる。
中規模のリポジトリでも桁が合わない。
加えて、無関係なコードを大量に入れると注意が拡散し、指摘が浅くなる傾向がある。
これはモデルに見せる量の話で、サーバーに送る量とは別である。
snapshot をサーバーに送っても、モデルに見せる 32K はサーバーが選別する。

**サーバー側にリポジトリを stateful に同期する。**
git で差分同期する方式は、同期と認証の仕組みが必要になり、ai-api が stateless でなくなる。
これは採らない。
一方で、毎回リクエストに snapshot を丸ごと載せる stateless な方式なら、同期機構は要らず、認証も既存の Bearer トークンで足りる。
文脈の収集をサーバーへ移す設計は、この stateless 版を採った（「全体構成」を参照）。
当初は Mac 側に git と `rg` が揃っていることを理由に収集を Mac 側へ置いたが、賢さをサーバー 1 箇所に集めるほうが、複数のクライアントを更新して回るより軽いと判断を改めた。

**Embedding と Vector DB による検索。**
精度は最も高くなりうるが、初期スコープに対して構築コストが見合わない。
将来の拡張候補として残す。

**MCP server として実装する。**
エージェントが型付きツールとして呼べる利点はあるが、常駐プロセスと各エージェントへの設定が要り、手打ちのシェルからは使えない。
`curl` のレシピであれば Claude Code、Codex、手打ちのシェルのいずれからも同じものが使える。

## 実測値

Mac から実機に対して初めて疎通した際の記録である。
いずれも 1 回ないし 2 回の試行にもとづく。

**mirrored モードでの到達性は確認できた。**
Mac から `http://<windows-ip>:11435/health` に到達し、認証なしの `POST /review` が 401 を返した。
WSL2 上の Docker コンテナが公開したポートに、Docker を挟んだうえで LAN から届く。

**モデルのロードは約 30 秒かかる。**
`translategemma:12b` に対する 1 回目の翻訳が 31.4 秒、モデルが常駐した状態での 2 回目が 0.87 秒だった。
差の大半がロード時間にあたる。

設計時には「D: の NVMe から読むため十数秒以内」を想定していたが、実際はその倍にあたる。
`OLLAMA_KEEP_ALIVE` を `5m` にした判断の代償は、想定より大きい。
review と translate を交互に使う場面では毎回この待ちが入る。

**28.5K トークンの入力に対するレビューは 34.5 秒だった（`qwen2.5-coder:14b`）。**
ただしこの値はモデルのロードを含む。
直前に translate を実行しており、`OLLAMA_MAX_LOADED_MODELS=1` により `qwen2.5-coder:14b` の再ロードが挟まっている。
ロードと推論を分離した計測はしていない。

**翻訳の品質は、短文 2 例では実用に足りた。**
日英・英日の双方向で意味の通る訳文が返った。
ただし "32K tokens" が「32,000 トークン」になるなど、単位の解釈に揺れがある。
長文や技術文書での品質は確かめていない。

**`qwen2.5-coder:14b` のレビュー指摘には誤りが混ざった。**
28.5K トークンの入力に対する 4 件の指摘のうち 2 件が、diff の読み違いによる誤検出だった。
1 件は改名前の中間状態を最終状態と取り違えたもの、もう 1 件は呼び出し側にある `null` 処理を見落としたものである。
別の PR に対しては、実在しないコードの初期化漏れを critical として報告した。
3 回の測定を通じて、採用できた指摘は無い。

この誤検出を q8_0 の KV cache に帰属させる根拠は無い。
入力が上限近くまで詰まっていたこと、diff が 2 つのコミットにまたがっていたことも同時に成り立っており、原因を切り分けていない。

**`qwen3:14b` は同じ題材で誤検出を出さなかった。**
意図的に仕込んだ 3 種のバグ（単一行の論理反転、引数ではなく古い値を参照する誤り、`src/sim/` での `Math.random()` による決定論規約違反）を、いずれも行番号と引用まで正確に検出した。
決定論規約は `CLAUDE.md` が context ファイルとして渡ったものを拾って適用しており、`rules` への配線がまだ無いにもかかわらず捕まえている。
`qwen2.5-coder:14b` は同じ 3 問で単一行の 1 つしか検出できなかった。

**`qwen3:14b` は遅い。**
15.4K トークンのレビューに 93.5 秒かかった。
同規模を `qwen2.5-coder:14b` は約 5 秒で返す。
差の主因は thinking mode で、応答の前に思考を挟むぶん時間がかかる。
入力が大きくなれば思考も伸びるため、`ai-api` のタイムアウト 300 秒に近づく可能性がある。
これは速度と正確性のトレードオフであり、正確性を優先して受け入れた。

いずれの比較も少数の題材によるもので、しかも意図的に露骨なバグを置いた人工的なものである。
実際の PR での検出率を測ったものではない。

## 未検証事項

以下は一次ソースで確認できていない。
実装や運用の中で確かめる。

- q8_0 の KV cache がレビュー品質に与える影響。16K + f16 との比較が要る。
- structured outputs がモデルの `tools` capability を要求するかどうか。Ollama の公式ドキュメントに記載がない。`qwen3:14b` は `tools` に対応しているため、当面は問題にならない。
- `qwen3:14b` の thinking が大きな入力でどこまで伸びるか。15.4K で 93 秒だが、28K 近い入力での所要とタイムアウト到達の有無を測っていない。
- `qwen3:14b` の実際の検出率。仕込みバグではなく、実際の PR でどれだけ捕まえ、どれだけ見逃すか。
- `wsl --install --location` が使える WSL のバージョン。公式ドキュメントにオプションの記載はあるが、導入時期の記載がない。
- `wsl --unregister` した際に `ext4.vhdx` が自動削除されるかどうか。公式ドキュメントに記載がなく、手動削除が要るという情報はコミュニティ Q&A のみである。
- ComfyUI と Ollama が VRAM を奪い合ったときの実際の挙動。とくに Ollama が部分オフロードに落ちる閾値。
- `PROMPT_OVERHEAD_TOKENS` が 512 で足りるかどうか。初回のレビューは 28505 トークンで、上限 28672 に対して残りが 167 しか無かった。413 とリトライが頻発するようなら見直す。

## 今後の拡張候補

- `POST /summarize`、`POST /design-review`、`POST /generate-tests`
- LiteLLM によるクラウド LLM へのフォールバック
- Open WebUI
- Embedding と Vector DB
