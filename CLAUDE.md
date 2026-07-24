# exocortex

Windows マシン (RTX 5080) をローカル LLM 推論サーバーとして動かし、Mac から HTTP 経由でコードレビューと日英翻訳を依頼する仕組みです。

このリポジトリでの作業は、Windows/WSL2 側の推論サーバーと Mac 側のクライアントのセットアップを完了させることを目的とします。

## セットアップ

手順は [`docs/get-started.md`](docs/get-started.md) にあります。
上から順に実行し、各手順の「確認」を満たしてから次に進んでください。

SSH 接続の確立（1 章）以降は、サーバー側のコマンドも `ssh exocortex "<command>"` の形で Mac から実行できます。
Windows の前に戻る必要があるのは、SSH 接続を成立させる 1 章と、`.wslconfig` のようなファイル編集を伴う一部の手順に限られます。

## 完了の判定基準

次の 3 つが満たされていれば、セットアップは完了しています。

1. `ssh exocortex "wsl -d <distro> -- docker ps --format \"{{.Names}} {{.Status}}\""` で `ai-api` と `ollama` がともに稼働している
2. SSH トンネルを張った状態で `curl http://localhost:11435/health` が `{"status":"ok"}` を返す
3. Claude Code の `exoc-review`/`exoc-translate` skill が動作する（使い方は [`docs/how-to-use.md`](docs/how-to-use.md) を参照）
