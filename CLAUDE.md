# exocortex

Windows マシン (RTX 5080) をローカル LLM 推論サーバーとして動かし、Mac から HTTP 経由でコードレビューと日英翻訳を依頼する仕組み。

設計の全体像と決定の理由は `docs/design.md` を参照する。実装の手順は `docs/implementation-plan.md` にある。作業を始める前に両方を読むこと。

## 構成

pnpm workspace のモノレポ。

| パッケージ | 役割 | 動作環境 |
|---|---|---|
| `packages/contract` | Request/Response の型と JSON Schema。唯一の正 | 両方 |
| `apps/api` | AI ロジック。プロンプト生成、Ollama 呼び出し、結果整形 | Windows/WSL2 |
| `apps/cli` | `ai-review` コマンド。git diff と関連ファイルの収集 | Mac |

## 責務の境界

この境界を崩さない。崩れると、モデルを差し替えるたびに CLI を直す羽目になる。

- `apps/api` はリポジトリの構造を知らない。git も `rg` も使わない。
- `apps/cli` は AI を知らない。プロンプトもモデル名も持たない。
- 型は必ず `packages/contract` に置く。api と cli で型を二重定義しない。

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

**context の上限は 32K トークン。** VRAM 16GB の制約による。超過時は 413 を返す。黙って切り詰めない。

**`ai-api` のポートは 11435。** コンテナの内と外で同じ番号を使う。8080 は mirrored networking mode で Windows 側と衝突しうるため使わない。49152 以降は ephemeral port range なので避ける。

**GPU は Windows ネイティブの ComfyUI と共有する。** 両者のモデルを同時にロードできない。競合してもエラーにならず静かに遅くなるため、`ollama ps` の `PROCESSOR` 列を日常的に確認する。調停は `OLLAMA_KEEP_ALIVE`（`5m`）だけで行い、自動で譲り合う仕組みは作らない。

**translategemma は system prompt が効かない。** 公式指定の英文テンプレートを user メッセージ 1 通に組み立てる。訳文の直前に空行を 2 つ置く指定まで含む。この癖は `apps/api` の中に閉じ込め、CLI に漏らさない。

**Zod は v4。** JSON Schema の生成は `z.toJSONSchema()` を使う。`zod-to-json-schema` はメンテナンス終了済みなので入れない。

**TypeScript 7.0 にはコンパイラ API が同梱されていない。** TS API に依存するビルドツール（tsup、ts-node など）を導入しない。ビルドは素の `tsc` で行う。

## テスト

実 GPU なしで回せる範囲を最大化する。

- `apps/api` のテストは Ollama を HTTP モックする。実際の推論は呼ばない。
- `apps/cli` のテストは一時 git リポジトリを作って行う。開発者の作業ツリーに依存しない。
- e2e は実機がある場合のみ。CI では走らせない。

実装は TDD で進める。テストを先に書き、失敗を確認してから実装する。
