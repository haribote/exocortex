# Windows セットアップ

Windows マシンを exocortex の推論サーバーとして立ち上げるまでの手順です。
専用の WSL ディストリビューションを新設し、その中で Docker と Ollama を動かし、Mac から HTTP で到達できる状態にします。

なぜこの構成を選んだかは `design.md` にあります。
ここでは手順と、各段階が成功したことをどう判定するかだけを書きます。

Mac 側の `ai-review` CLI の導入は、この文書の範囲外です。

## この文書の読み方

### プレースホルダ

環境ごとに変わる値は、山括弧で囲んだ小文字の語で示します。

| プレースホルダ | 意味 | 取得方法 |
|---|---|---|
| `<windows-ip>` | Windows マシンの LAN 内 IPv4 アドレス | 手順 12 の `ipconfig` |
| `<windows-user>` | Windows のユーザー名 | `C:\Users` の下にあるディレクトリ名 |
| `<linux-user>` | ディストロの中に作る UNIX ユーザー名 | 手順 2 で自分が決める |
| `<distro>` | 新設したディストロの名前 | 手順 2 で確定する |

置き換えるときは山括弧ごと置き換えます。
`<` と `>` を残しません。

手順 5 に出てくる GUID `{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}` はプレースホルダではありません。
WSL に固定で割り当てられた既知の値なので、そのまま入力します。

### コマンドの実行場所

コードブロックの先頭のコメントが、どこで実行するかを示します。

- `PowerShell`：Windows の PowerShell
- `管理者 PowerShell`：管理者として実行した PowerShell
- `<distro>`：新設したディストロの中のシェル
- `Mac`：Mac のシェル

各手順は「実行」「確認」「失敗したら」の順に並びます。
期待する出力を載せている箇所がありますが、これは版によって揺れます。
判定の基準になるのは、出力そのものではなく、添えてある散文の条件のほうです。

### 未検証の印

一部の手順には次の 1 行が付いています。

> **未検証** この手順はまだ実機で確認していません。

該当するものは末尾の「[未検証事項](#未検証事項)」にまとめてあります。

## 前提

| 項目 | 必要な条件 |
|---|---|
| GPU | NVIDIA 製、VRAM 16GB 以上（想定は RTX 5080） |
| NVIDIA ドライバ | 550 以降 |
| Windows | Windows 11 22H2 以降（`networkingMode=mirrored` の要件） |
| 仮想化 | BIOS/UEFI で有効 |
| 権限 | 管理者権限を使える |
| D: の空き容量 | 60GB 以上（モデル 2 本で 16GB、Docker のイメージとビルドキャッシュを含む） |
| ネットワーク | Mac と Windows が同一 LAN にある |

Windows ネイティブの ComfyUI が動いているなら、GPU ドライバの条件は満たしています。
ドライバの導入手順はこの文書には含めません。

WSL の中に GPU ドライバを入れる必要はありません。
WSL2 は Windows 側のドライバを共有します。

## 1. WSL のバージョンを確認する

systemd を使うには WSL 0.67.6 以降が必要です。

```powershell
# PowerShell
wsl --version
```

**確認**

`WSL バージョン` の行が 0.67.6 以降であれば、この先の手順が通ります。
古い場合は `wsl --update` で更新します。

コマンド自体が認識されない場合、WSL が Microsoft Store 版ではなく古い Windows コンポーネント版です。
`wsl --update` で Store 版に移行してから先に進みます。

なお、次の手順で使う `--location` については、対応バージョンが公式ドキュメントに書かれていません。
使えるかどうかは実行してみるまで分かりません。

## 2. 専用ディストロを D: に新設する

既存のディストロには触れません。
新設したものは、失敗しても `wsl --unregister` でやり直せます。

**実行**

```powershell
# PowerShell
wsl --install -d Ubuntu --location D:\wsl\exocortex --name exocortex
```

`--name` を省くと、ディストロの名前はディストリビューション名（`Ubuntu`）になります。
同じ名前のディストロがすでにある環境では、次のエラーで失敗します。

```text
指定された名前のディストリビューションは既に存在します。--name を使用して別の名前を選択してください。
エラー コード: Wsl/InstallDistro/Service/RegisterDistro/ERROR_ALREADY_EXISTS
```

`--name` は Microsoft Learn のオプション一覧には記載がありませんが[^wslcmd]、WSL 自身がこのエラーで案内するとおり、実際に使えます。

初回の起動で UNIX のユーザー名とパスワードを尋ねられます。
ここで作るユーザーは Windows のアカウントとは無関係です。
決めた名前が `<linux-user>` になります。

`--location` が使えなかった場合は、`wsl --import` を使います。

```powershell
# PowerShell
wsl --import exocortex D:\wsl\exocortex <rootfs-tar> --version 2
```

`<rootfs-tar>` には Ubuntu の WSL 用 rootfs アーカイブのパスを渡します。
ユーザーの作成と既定ユーザーの設定は、手順 3 で `/etc/wsl.conf` を編集するときにあわせて行います。

**確認**

```powershell
# PowerShell
wsl -l -v
```

新しいディストロが一覧に現れ、`VERSION` が 2 であれば成功です。

```text
  NAME        STATE           VERSION
* exocortex   Running         2
  Ubuntu      Stopped         2
```

ここで確定した名前が、以降の `<distro>` です。

**失敗したら**

`--location` が認識されずエラーになる場合は、上記の `wsl --import` に切り替えます。
どちらの経路を通ったかは、後で読み返すときに効くので記録しておきます。

## 3. systemd を有効にする

Docker が systemd を必要とします。

**実行**

まず現状を確認します。
`wsl --install` で入れた最近の Ubuntu イメージには、`systemd=true` が最初から入っています。

```bash
# <distro>
cat /etc/wsl.conf
```

`[boot]` の下に `systemd=true` があれば、ここで書き足すものはありません。
確認に進みます。

無ければ追記します。

```ini
[boot]
systemd=true
```

手順 2 で `wsl --import` を使った場合は、既定ユーザーの設定もここで書きます。
`--import` は初回のユーザー作成プロンプトを出さないため、これが無いと root で入ることになります。

```ini
[user]
default=<linux-user>
```

`/etc/wsl.conf` を編集した場合は、WSL を再起動して反映します。

```powershell
# PowerShell
wsl --shutdown
```

このコマンドは実行中のすべてのディストロを終了させます。
他のディストロで作業中であれば、巻き込まれます。

**確認**

```bash
# <distro>
systemctl is-system-running
```

`running` または `degraded` が返れば systemd が動いています。
`degraded` は一部のユニットが失敗している状態ですが、Docker の導入には支障ありません。

**失敗したら**

`System has not been booted with systemd` が返る場合、`wsl --shutdown` が効いていないか、`wsl.conf` の書式が誤っています。
`--import` で作ったディストロでは、ファイルの位置を間違えていないかも確認します。

## 4. networking を mirrored にする

WSL2 は既定で NAT モードのため、Mac から到達できません。
理由は `design.md` の「[Windows セットアップ](design.md#windows-セットアップ)」にあります。

**実行**

`C:\Users\<windows-user>\.wslconfig` を作り、次を書きます。

```ini
[wsl2]
networkingMode=mirrored
```

```powershell
# PowerShell
wsl --shutdown
```

この設定は WSL2 の VM 全体に効きます。
ディストロごとに分ける手段はないため、既存のディストロの通信にも影響します。

**確認**

```bash
# <distro>
ip addr show
```

Windows 側のネットワークインターフェイスと同じアドレスが見えていれば、mirrored が効いています。

**失敗したら**

既存のディストロや VPN の通信が壊れた場合は、`.wslconfig` から `networkingMode` の行を削除し、`wsl --shutdown` で戻します。
この手順は既存環境に影響する唯一の箇所なので、戻し方を先に把握しておきます。

## 5. Hyper-V ファイアウォールで受信を許可する

mirrored モードでは、Hyper-V ファイアウォールが受信を既定で遮ります。

**実行**

```powershell
# 管理者 PowerShell
Set-NetFirewallHyperVVMSetting -Name '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}' -DefaultInboundAction Allow
```

この GUID は WSL に固定で割り当てられた値です。
自分の環境の何かに置き換えるものではありません。

**確認**

```powershell
# 管理者 PowerShell
Get-NetFirewallHyperVVMSetting -Name '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}'
```

`DefaultInboundAction` が `Allow` であれば設定できています。

## 6. Docker Engine を導入する

Docker Desktop は使いません。
公式の apt リポジトリから Docker Engine を入れます[^docker]。

**実行**

先にディストロ全体を更新します。
新設した直後のイメージには未適用の更新が溜まっているため、これを済ませてから外部のリポジトリを足します。

```bash
# <distro>
sudo apt update
sudo apt full-upgrade
```

更新にライブラリや systemd が含まれた場合は、ディストロを入れ直します。

```powershell
# PowerShell
wsl --terminate <distro>
```

WSL のカーネルは Windows 側が提供するため、ここでカーネルが更新されることはありません。

続いて Docker の apt リポジトリを登録します。

```bash
# <distro>
sudo apt install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

```bash
# <distro>
sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

`sudo` なしで docker を使えるようにします[^postinstall]。

```bash
# <distro>
sudo usermod -aG docker $USER
```

グループの変更は、入り直すまで反映されません。
ディストロを終了してから入り直します。

```powershell
# PowerShell
wsl --terminate <distro>
```

公式の手順にある `newgrp docker` でも反映できますが、WSL の Ubuntu イメージには `newgrp` が入っていないことがあります。
入り直すほうが確実です。

Windows の再起動後にも Docker が上がるよう、サービスを有効にします。

```bash
# <distro>
sudo systemctl enable --now docker
```

**確認**

```bash
# <distro>
docker run --rm hello-world
```

`Hello from Docker!` が表示されれば導入できています。

**失敗したら**

`permission denied` が出る場合は、入り直しが済んでいません。
`wsl --terminate <distro>` をもう一度実行してから試します。

## 7. nvidia-container-toolkit を導入する

コンテナから GPU を使うために必要です[^nvidia]。

**実行**

```bash
# <distro>
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt update
sudo apt install -y nvidia-container-toolkit
```

```bash
# <distro>
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

**確認**

```bash
# <distro>
docker run --rm --gpus all ubuntu nvidia-smi
```

GPU の名前と VRAM 容量が表示されれば、コンテナから GPU が見えています。

**失敗したら**

`nvidia-ctk runtime configure` の後に Docker を再起動し忘れていないかを確認します。
それでも失敗する場合、ディストロの中に Linux 用の GPU ドライバを入れてしまっていないかを見ます。
WSL2 では Windows 側のドライバを共有するため、Linux 側にドライバを入れると衝突します。

## 8. リポジトリを clone して .env を作る

**実行**

clone 先はディストロの中のホームディレクトリにします。
`/mnt/c` や `/mnt/d` に置くと、Windows のファイルシステムを経由するぶん遅くなります。

```bash
# <distro>
cd ~
git clone https://github.com/haribote/exocortex.git
cd exocortex
cp .env.example .env
```

`API_TOKEN` を生成し、`.env` に書きます。

```bash
# <distro>
openssl rand -hex 32
```

生成したトークンは Mac 側でも使います。
リポジトリに commit したり、この文書に書き写したりはしません。
`.env` は `.gitignore` に入っています。

**確認**

```bash
# <distro>
grep -c '^API_TOKEN=.\+' .env
```

`1` が返れば `API_TOKEN` に値が入っています。

## 9. 起動してモデルを取得する

**実行**

```bash
# <distro>
docker compose up -d
docker compose exec ollama ollama pull qwen2.5-coder:14b
docker compose exec ollama ollama pull translategemma:12b
```

2 本あわせて 16GB を超えるため、回線によっては時間がかかります。
途中で止まった場合は同じコマンドを再実行すると再開します。

**確認**

```bash
# <distro>
docker compose ps
docker compose exec ollama ollama list
```

`ollama` と `ai-api` の両方が `running` で、モデルが 2 本並んでいれば成功です。

```bash
# <distro>
curl http://localhost:11435/health
```

ディストロの中から `/health` が返れば、`ai-api` は動いています。

## 10. VRAM の割り当てを確認する

**ComfyUI を終了させてから行います。**
起動したままだと GPU を奪われ、この計測の意味が失われます。

**実行**

レビューを 1 回投げてモデルをロードさせます。

```bash
# <distro>
curl -X POST http://localhost:11435/review \
  -H "Authorization: Bearer $(grep '^API_TOKEN=' .env | cut -d= -f2)" \
  -H 'Content-Type: application/json' \
  -d '{"language":"typescript","diff":"diff --git a/a.ts b/a.ts\n+const x = 1\n"}'
```

```bash
# <distro>
docker compose exec ollama ollama ps
```

**確認**

`CONTEXT` が 32768 で、`PROCESSOR` が `100% GPU` であれば、モデルは VRAM に収まっています。

`100% CPU` や部分ロードになっている場合、VRAM に収まっていません。
対処の順序は `design.md` の「[context 長と KV cache](design.md#context-長と-kv-cache)」にあります。

`SIZE` と `CONTEXT` の値は「[実測値の記録](#実測値の記録)」に書き足します。

この確認はセットアップ時の一度きりではありません。
ComfyUI と GPU を共有する以上、日常の診断手段になります。
理由は `design.md` の「[GPU の共有](design.md#gpu-の共有)」にあります。

> **未検証** VRAM が競合したときに Ollama が部分オフロードへ落ちる閾値は、まだ確認していません。

## 11. モデルのロード時間を測る

`OLLAMA_KEEP_ALIVE` を `5m` にした判断の代償が、モデルの再ロードにかかる時間です。

**実行**

```bash
# <distro>
docker compose restart ollama
```

再起動の直後にレビューを 1 回投げ、レスポンスの `meta.durationMs` を記録します。
続けてもう 1 回投げ、同じ値を記録します。

**確認**

2 回の差がモデルのロード時間にあたります。
両方の値を「[実測値の記録](#実測値の記録)」に書き足します。

> **未検証** D: の NVMe からのロード時間は、まだ測っていません。

## 12. Mac から疎通を確認する

**実行**

Windows マシンの LAN 内アドレスを調べます。

```powershell
# PowerShell
ipconfig
```

LAN に接続しているアダプタの `IPv4 アドレス` が `<windows-ip>` です。

```bash
# Mac
curl http://<windows-ip>:11435/health
```

**確認**

`/health` のレスポンスが返れば、Mac から届いています。

続けて認証付きのエンドポイントを叩きます。

```bash
# Mac
curl -X POST http://<windows-ip>:11435/review \
  -H "Authorization: Bearer <api-token>" \
  -H 'Content-Type: application/json' \
  -d '{"language":"typescript","diff":"diff --git a/a.ts b/a.ts\n+const x = 1\n"}'
```

レビュー結果の JSON が返れば、この文書の範囲は完了です。

**失敗したら**

どこで切れているかを 3 段で切り分けます。

1. ディストロの中から `curl http://localhost:11435/health`。
   ここで失敗するならコンテナ側の問題です。手順 9 に戻ります。
2. Windows の PowerShell から `curl.exe http://localhost:11435/health`。
   ここで失敗するなら mirrored モードか Hyper-V ファイアウォールの問題です。手順 4 と手順 5 を確認します。
3. Mac から `<windows-ip>` 宛て。
   ここだけ失敗するなら Windows Defender ファイアウォールか、Mac と Windows が別セグメントにいる可能性があります。

mirrored モードで Docker が公開したポートに届かない場合の退避路として、`networkingMode` を既定に戻し、`netsh interface portproxy` で転送する方法があります。

```powershell
# 管理者 PowerShell
netsh interface portproxy add v4tov4 listenport=11435 listenaddress=0.0.0.0 connectport=11435 connectaddress=$(wsl -d <distro> hostname -I)
```

WSL2 の IP アドレスは再起動のたびに変わるため、この方法を採ると起動ごとの再設定が要ります。
mirrored が使えるならそちらを選びます。

> **未検証** WSL2 上の Docker コンテナが公開したポートについて、mirrored モードでの到達性は確認できていません。Microsoft の文書は WSL2 一般の記述にとどまり、Docker を挟んだ場合の記載がありません。

## 13. Windows の再起動後に自動で上がるようにする

`docker-compose.yml` の `restart: unless-stopped` が担保するのは、コンテナの再起動だけです。
Windows を再起動すると WSL の VM 自体が停止しているため、Mac から呼んでも届きません。

**実行**

タスクスケジューラに、ログオン時にディストロを起動するタスクを登録します。

```powershell
# 管理者 PowerShell
$action = New-ScheduledTaskAction -Execute 'wsl.exe' -Argument '-d <distro> -- /bin/true'
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName 'exocortex-wsl-boot' -Action $action -Trigger $trigger
```

ディストロが起動すれば、手順 6 で `systemctl enable` した Docker が上がり、`restart: unless-stopped` のコンテナが続いて起動します。

**確認**

Windows を再起動し、ログオン後に Mac から `/health` を叩きます。

```bash
# Mac
curl http://<windows-ip>:11435/health
```

**失敗したら**

タスクスケジューラの履歴でタスクが実行されたかを見ます。
実行されているのにコンテナが上がっていない場合は、ディストロの中で `systemctl status docker` を確認します。

> **未検証** この方法で Windows 再起動後にコンテナが上がるかどうかは、まだ確認していません。

## 実測値の記録

以下は筆者の環境での実測であり、他の環境での動作を保証するものではありません。
ComfyUI の起動状態で値が変わるため、条件を添えて記録します。

| 測定項目 | 値 | 測定日 | 条件 |
|---|---|---|---|
| `ollama ps` の `SIZE`（qwen2.5-coder:14b） | 未測定 | 未測定 | ComfyUI 停止時 |
| `ollama ps` の `CONTEXT` | 未測定 | 未測定 | ComfyUI 停止時 |
| 初回リクエストの `meta.durationMs` | 未測定 | 未測定 | `docker compose restart ollama` 直後 |
| 2 回目以降の `meta.durationMs` | 未測定 | 未測定 | モデル常駐時 |
| 差分（モデルのロード時間） | 未測定 | 未測定 | 上 2 行の差 |

## 未検証事項

この表がすべて埋まるまで、この文書は完成していません。
状態は `未検証`、`確認済み`、`回避策あり` の 3 つで表します。

| 項目 | 該当手順 | 状態 | 判明したこと |
|---|---|---|---|
| `wsl --install` の `--location` と `--name` が使えるか | 2 | 確認済み | どちらも使える。`--name` は Microsoft Learn のオプション一覧に記載がないが、WSL のエラーメッセージが案内し、実際に動作する。対応する WSL のバージョンは依然として不明 |
| VRAM が競合したときに Ollama が部分オフロードへ落ちる閾値 | 10 | 未検証 | 未確認 |
| D: の NVMe からのモデルのロード時間 | 11 | 未検証 | 未確認 |
| mirrored モードでの Docker コンテナのポート到達性 | 12 | 未検証 | 未確認 |
| タスクスケジューラ経由で Windows 再起動後にコンテナが上がるか | 13 | 未検証 | 未確認 |
| `wsl --unregister` で `ext4.vhdx` が自動削除されるか | 撤収 | 未検証 | 未確認 |

## 撤収とやり直し

新設したディストロは、既存の WSL 環境から独立しています。
やり直すときは、このディストロだけを消せば済みます。

```powershell
# PowerShell
wsl --unregister <distro>
```

登録を解除すると、そのディストロのデータ、設定、導入したソフトウェアはすべて失われます。
`.env` の `API_TOKEN` も消えるため、必要なら先に控えます。

`ext4.vhdx` が自動で削除されるかどうかは公式ドキュメントに記載がありません。
`D:\wsl\exocortex` に残っている場合は手動で削除します。

```powershell
# PowerShell
Get-ChildItem D:\wsl\exocortex
```

手順 4 で書いた `.wslconfig` は VM 全体の設定であり、ディストロの登録解除では消えません。
mirrored モードをやめる場合は、`networkingMode` の行を削除して `wsl --shutdown` します。

[^wslcmd]: [Basic commands for WSL - Microsoft Learn](https://learn.microsoft.com/en-us/windows/wsl/basic-commands)

[^docker]: [Install Docker Engine on Ubuntu - Docker Docs](https://docs.docker.com/engine/install/ubuntu/)

[^postinstall]: [Linux post-installation steps for Docker Engine - Docker Docs](https://docs.docker.com/engine/install/linux-postinstall/)

[^nvidia]: [Installing the NVIDIA Container Toolkit - NVIDIA Docs](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)
