# exocortex

クライアントから HTTP 経由で、ローカル LLM 推論サーバーにコードレビューと日英翻訳を依頼する仕組み。

このリポジトリでの作業は、サーバー（Windows/WSL2）とクライアントのセットアップを完了させることを目的とする。

## セットアップ

手順は [`docs/get-started.md`](docs/get-started.md) にある。
上から順に実行し、各手順の「確認」を満たしてから次に進む。

SSH 接続の確立（1 章）以降は、サーバー側のコマンドも `ssh exocortex "<command>"` の形でクライアントから実行できる。
サーバーの前に戻る必要があるのは、SSH 接続を成立させる 1 章と、`.wslconfig` のようなファイル編集を伴う一部の手順に限られる。

## 完了の判定基準

次の 3 つが満たされていれば、セットアップは完了している。

1. `ssh exocortex "wsl -d <distro> -- docker ps --format \"{{.Names}} {{.Status}}\""` で `ai-api` と `ollama` がともに稼働している
2. SSH トンネルを張った状態で `curl http://localhost:11435/health` が `{"status":"ok"}` を返す
3. Claude Code の `exoc-review`/`exoc-translate` skill が動作する（使い方は [`docs/how-to-use.md`](docs/how-to-use.md) を参照）
