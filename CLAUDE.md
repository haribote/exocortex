# exocortex

Windows マシン (RTX 5080) をローカル LLM 推論サーバーとして動かし、Mac から HTTP 経由でコードレビューと日英翻訳を依頼する仕組み。

設計の全体像と決定の理由は `docs/design.md` を参照する。HTTP 契約とクライアントの叩き方は `docs/api-usage.md` にある。作業を始める前に両方を読むこと。

## 構成

pnpm workspace のモノレポ。

| パッケージ | 役割 | 動作環境 |
|---|---|---|
| `packages/contract` | Request/Response の型と JSON Schema。唯一の正 | Windows/WSL2 |
| `apps/api` | snapshot の展開、git diff、関連ファイル解決、context 選別、プロンプト生成、Ollama 呼び出し、結果整形 | Windows/WSL2 |

クライアントは配布物を持たない。`/review` は「作業ツリーと `.git` を tar して POST する固定レシピ」で、`/translate` は `curl` の直接呼び出し。どちらも `~/.claude/skills/` 側の skill（dotfiles 管理、この repo 外）が実行する。

## 責務の境界

- `apps/api` がリポジトリの知識を持つ。snapshot を展開して git と `rg` を回し、diff と context を組む。
- クライアント（skill/recipe）は AI を知らない。snapshot を送るだけで、プロンプトもモデル名も選別も持たない。
- 型は `packages/contract` に置く。消費者は `apps/api` だけ。

この境界により、モデルを差し替えてもクライアントは無傷で済む。クライアントが送る snapshot はモデルにも言語にも依存しない固定の形だからである。

## コマンド

```bash
pnpm install
pnpm test           # 全パッケージのテスト
pnpm lint           # Biome
pnpm build          # tsc
```

Docker は Windows/WSL2 側でのみ動かす。動かす先は exocortex 専用の WSL ディストロ（`D:\wsl\exocortex`）で、既存のディストロは使わない。

```bash
docker compose up -d
docker compose logs -f ai-api
```

## 実装上の注意

**Ollama を LAN に公開しない。** `docker-compose.yml` の `ollama` サービスに `ports:` を書かない。外部に出すのは `ai-api` だけ。

**context の上限は 32K トークン。** VRAM 16GB の制約による。`apps/api` が本物ではなく文字数概算で予算内に収め、優先度の低い context ファイルから落とす。落とした数は `meta.droppedContextFiles` に返す。diff 単体が予算を超えるときだけは削れないので 413 を返す。

**`apps/api` は git と `rg` を実行する。** 受け取った snapshot を隔離した一時ディレクトリに展開し、そこで diff の算出と関連ファイルの走査を行う。コンテナには `git` と `ripgrep` を同梱する。一時ディレクトリはリクエストごとに作り、処理後に破棄する。

**`ai-api` のポートは 11435。** コンテナの内と外で同じ番号を使う。8080 は mirrored networking mode で Windows 側と衝突しうるため使わない。49152 以降は ephemeral port range なので避ける。

**GPU は Windows ネイティブの ComfyUI と共有する。** 両者のモデルを同時にロードできない。競合してもエラーにならず静かに遅くなるため、`ollama ps` の `PROCESSOR` 列を日常的に確認する。調停は `OLLAMA_KEEP_ALIVE`（`5m`）だけで行い、自動で譲り合う仕組みは作らない。

**translategemma は system prompt が効かない。** 公式指定の英文テンプレートを user メッセージ 1 通に組み立てる。訳文の直前に空行を 2 つ置く指定まで含む。この癖は `apps/api` の中に閉じ込め、クライアントに漏らさない。

**Zod は v4。** JSON Schema の生成は `z.toJSONSchema()` を使う。`zod-to-json-schema` はメンテナンス終了済みなので入れない。

**TypeScript 7.0 にはコンパイラ API が同梱されていない。** TS API に依存するビルドツール（tsup、ts-node など）を導入しない。ビルドは素の `tsc` で行う。

## テスト

実 GPU なしで回せる範囲を最大化する。

- `apps/api` のテストは Ollama を HTTP モックする。実際の推論は呼ばない。
- snapshot 展開、diff 算出、関連解決、context 選別のテストは一時 git リポジトリを tar して行う。開発者の作業ツリーに依存しない。
- クライアントの固定レシピ（tar と curl）はこの repo で unit test しない。正しさは e2e と手動で確かめる。
- e2e は実機がある場合のみ。CI では走らせない。

実装は TDD で進める。テストを先に書き、失敗を確認してから実装する。
