# Get started

exocortex の推論サーバーを立ち上げ、クライアントから使える状態にするまでの手順である。

SSH 接続の確立を最初の章に置く。
一度 `ssh exocortex` が通れば、それ以降の Windows/WSL2 側のセットアップはクライアントから `ssh exocortex "<command>"` の形でそのまま進められる。
サーバーの前に戻って操作する場面は、SSH 接続そのものを成立させる 1 章と、ひとまとまりのファイル編集を伴う一部の手順に限られる。

## 目次

- [この文書の読み方](#この文書の読み方)
  - [プレースホルダ](#プレースホルダ)
  - [コマンドの実行場所](#コマンドの実行場所)
- [前提](#前提)
- [1. SSH 接続を確立する](#1-ssh-接続を確立する)
  - [1.1 クライアント側で鍵ペアを作る](#11-クライアント側で鍵ペアを作る)
  - [1.2 OpenSSH Server を導入する](#12-openssh-server-を導入する)
  - [1.3 公開鍵を配置する](#13-公開鍵を配置する)
  - [1.4 パスワード認証を無効化する](#14-パスワード認証を無効化する)
  - [1.5 LAN 内からだけ port 22 に届くようにする](#15-lan-内からだけ-port-22-に届くようにする)
  - [1.6 SSH 接続を確認する](#16-ssh-接続を確認する)
- [2. サーバー（Windows/WSL2）をセットアップする](#2-サーバーwindowswsl2をセットアップする)
  - [2.1 WSL のバージョンを確認する](#21-wsl-のバージョンを確認する)
  - [2.2 ディストロを選ぶ](#22-ディストロを選ぶ)
  - [2.3 systemd を有効にする](#23-systemd-を有効にする)
  - [2.4 networking を mirrored にする](#24-networking-を-mirrored-にする)
  - [2.5 Hyper-V ファイアウォールで受信を許可する](#25-hyper-v-ファイアウォールで受信を許可する)
  - [2.6 Docker Engine を導入する](#26-docker-engine-を導入する)
  - [2.7 nvidia-container-toolkit を導入する](#27-nvidia-container-toolkit-を導入する)
  - [2.8 リポジトリを clone する](#28-リポジトリを-clone-する)
  - [2.9 起動してモデルを取得する](#29-起動してモデルを取得する)
  - [2.10 VRAM の割り当てを確認する](#210-vram-の割り当てを確認する)
- [3. Claude Code skill を導入する](#3-claude-code-skill-を導入する)
- [撤収とやり直し](#撤収とやり直し)

## この文書の読み方

### プレースホルダ

環境ごとに変わる値は、山括弧で囲んだ小文字の語で示す。

| プレースホルダ   | 意味                                    | 取得方法                                                                       |
| ---------------- | --------------------------------------- | ------------------------------------------------------------------------------ |
| `<windows-ip>`   | サーバーの LAN 内 IPv4 アドレス         | 2.1 節の `ipconfig`                                                            |
| `<windows-user>` | サーバーのユーザー名                    | `C:\Users` の下にあるディレクトリ名                                            |
| `<linux-user>`   | ディストロの中の UNIX ユーザー名        | 既存のディストロならすでに決まっている値、新設するなら初回起動時に自分で決める |
| `<distro>`       | セットアップ先の WSL ディストロ名       | 既存のディストロを使うならその名前、新設するなら 2.2 節で決める                |
| `<public-key>`   | クライアントで生成した SSH 公開鍵の中身 | 1.1 節の `cat ~/.ssh/exocortex_ed25519.pub`                                    |

置き換えるときは山括弧ごと置き換える。
`<` と `>` を残さない。

手順 2.5 に出てくる GUID `{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}` はプレースホルダではない。
WSL に固定で割り当てられた既知の値なので、そのまま入力する。

### コマンドの実行場所

コードブロックの先頭のコメントが、どこで実行するかを示す。

- `クライアント`：クライアントのシェルで直接実行する
- `クライアント（SSH 経由）`：クライアントから `ssh exocortex "<command>"` の形で、1 コマンドとして実行する
- `クライアント（SSH 経由、ディストロ内）`：`ssh exocortex "wsl -d <distro>"` でディストロのシェルに入ってから実行する。複数行にわたる、または引用符が入れ子になる手順はこの形を使う。1 コマンドに詰め込んでエスケープを重ねるより、ログインしてそのまま打つほうが事故りにくい
- `PowerShell` / `管理者 PowerShell`：サーバーの前で実行する。SSH 接続を確立するまでの一部の手順と、ファイル編集を伴う一部の手順に限られる

各手順は「実行」「確認」の順に並ぶ。
期待する出力を載せている箇所があるが、これは版によって揺れる。
判定の基準になるのは、出力そのものではなく、添えてある散文の条件のほうである。

## 前提

| 項目               | 必要な条件                                                                 |
| ------------------ | -------------------------------------------------------------------------- |
| GPU                | NVIDIA 製、VRAM 16GB 以上                                                  |
| NVIDIA ドライバ    | 550 以降                                                                   |
| Windows            | Windows 11 22H2 以降（`networkingMode=mirrored` の要件）                   |
| 仮想化             | BIOS/UEFI で有効                                                           |
| 権限               | 管理者権限を使える                                                         |
| ディスクの空き容量 | 60GB 以上（モデル 2 本で 16GB、Docker のイメージとビルドキャッシュを含む） |
| ネットワーク       | クライアントとサーバーが同一 LAN にある                                    |

ドライバの導入手順はこの文書には含めない。
ホスト OS である Windows に最新の Game Ready ドライバーが入っていれば良い。
WSL の中に GPU ドライバを入れる必要はない。

## 1. SSH 接続を確立する

### 1.1 クライアント側で鍵ペアを作る

exocortex 専用の鍵ペアを作る。
GitHub 用など他の鍵と混ぜない。

**実行**

```bash
# クライアント
ssh-keygen -t ed25519 -f ~/.ssh/exocortex_ed25519 -C "exocortex-windows"
```

`~/.ssh/config` にホストエイリアスを足しておくと、以降は `ssh exocortex` だけで繋がる。

```
Host exocortex
  HostName <windows-ip>
  User <windows-user>
  IdentityFile ~/.ssh/exocortex_ed25519
  IdentitiesOnly yes
```

`HostName` に指定する `<windows-ip>` は固定しておくことを推奨する。
DHCP でアドレスが変わると、ここが古いままになり接続できなくなる。

固定の方法はルーターによって異なるため、詳しくはルーターの説明書などを参照する。

**確認**

```bash
# クライアント
cat ~/.ssh/exocortex_ed25519.pub
```

- [ ] 表示された公開鍵を `<public-key>` として控えた（以降の手順で使う）

### 1.2 OpenSSH Server を導入する

一次ソースは Microsoft Learn の [OpenSSH Server 導入手順](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse)である[^openssh-install]。

**実行**

```powershell
# 管理者 PowerShell
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
Start-Service sshd
Set-Service -Name sshd -StartupType 'Automatic'
```

**確認**

```powershell
# 管理者 PowerShell
Get-NetFirewallRule -Name "OpenSSH-Server-In-TCP"
```

- [ ] `Enabled` が `True` になっている（導入時に自動作成されるファイアウォールルール）

### 1.3 公開鍵を配置する

配置先は `<windows-user>` が Administrators グループに属すかどうかで変わる[^openssh-keys]。
個人機の既定アカウントは Administrators に属していることがほとんどである。

**Administrators への所属確認**

```powershell
# PowerShell
(Get-LocalGroupMember -Group "Administrators").Name -contains "$env:COMPUTERNAME\$env:USERNAME"
```

`True` の場合は `administrators_authorized_keys` に置く。
このファイルは Administrators と SYSTEM だけが読めるよう ACL を絞る必要がある。

**実行（True だった場合）**

```powershell
# 管理者 PowerShell
Add-Content -Force -Path C:\ProgramData\ssh\administrators_authorized_keys -Value '<public-key>'
icacls.exe "C:\ProgramData\ssh\administrators_authorized_keys" /inheritance:r /grant "Administrators:F" /grant "SYSTEM:F"
```

**実行（False だった場合）**

```powershell
# PowerShell
New-Item -Force -ItemType Directory -Path $env:USERPROFILE\.ssh
Add-Content -Force -Path $env:USERPROFILE\.ssh\authorized_keys -Value '<public-key>'
```

**確認**

```powershell
# 管理者 PowerShell（True だった場合）
Get-Content C:\ProgramData\ssh\administrators_authorized_keys
```

```powershell
# PowerShell（False だった場合）
Get-Content $env:USERPROFILE\.ssh\authorized_keys
```

- [ ] 公開鍵が 1 行だけ、途中で改行されずに入っている

### 1.4 パスワード認証を無効化する

**実行**

```powershell
# 管理者 PowerShell
(Get-Content C:\ProgramData\ssh\sshd_config) `
  -replace '^#?\s*PasswordAuthentication\s+.*', 'PasswordAuthentication no' `
  -replace '^#?\s*PubkeyAuthentication\s+.*', 'PubkeyAuthentication yes' |
  Set-Content C:\ProgramData\ssh\sshd_config
Restart-Service sshd
```

**確認**

```powershell
# 管理者 PowerShell
Select-String -Path C:\ProgramData\ssh\sshd_config -Pattern 'PasswordAuthentication|PubkeyAuthentication'
```

- [ ] `PasswordAuthentication no` が出ている
- [ ] `PubkeyAuthentication yes` が出ている

### 1.5 LAN 内からだけ port 22 に届くようにする

サーバーの既定はネットワークプロファイルは `Public` を選択し、必要なポートだけピンポイントで
開けることを勧める。
ネットワーク全体を `Private` に変えると、ネットワーク検出やファイル共有まで有効になり、
SSH を通したいだけの目的に対して余計な露出が増える。
そのため `OpenSSH-Server-In-TCP` ルールだけを、同一LANのサブネットに限りどのプロファイルでも
許可する形に絞る。

**実行**

```powershell
# 管理者 PowerShell
Set-NetFirewallRule -Name 'OpenSSH-Server-In-TCP' -Profile Any -RemoteAddress LocalSubnet
```

**確認**

```powershell
# 管理者 PowerShell
Get-NetFirewallRule -Name OpenSSH-Server-In-TCP | Get-NetFirewallAddressFilter
Get-NetConnectionProfile
```

- [ ] `RemoteAddress` が `LocalSubnet` になっている
- [ ] `NetworkCategory` を変えていない（`Public` のままでよい）

**うまくいかないとき**

クライアントから port 22 が繋がらない（`Operation timed out`）のに、サーバーのローカルからは
`Test-NetConnection -ComputerName localhost -Port 22` が成功する場合、ファイアウォールルールの
`Profile` と実際の `NetworkCategory` が食い違っている。
`Get-NetFirewallRule -Name OpenSSH-Server-In-TCP | Get-NetFirewallProfile` で、ルールが
今のネットワークプロファイルに適用される設定になっているかを確認する。

### 1.6 SSH 接続を確認する

**実行**

初回接続なので、`known_hosts` に登録する前に本物のサーバーに繋がっているかを確かめる。

```bash
# クライアント
ssh-keyscan -t ed25519 <windows-ip>
```

```powershell
# 管理者 PowerShell（ホスト鍵は Administrators/SYSTEM のみ読める ACL のため管理者権限が要る）
Get-Content C:\ProgramData\ssh\ssh_host_ed25519_key.pub
```

両方の鍵の実体（`ssh-ed25519 AAAA...` の部分）が一致していれば、正しい相手である。

```bash
# クライアント
ssh exocortex "echo ok"
```

**確認**

```bash
# クライアント
ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no exocortex "echo should-fail"
```

- [ ] パスワードの入力を求められずに拒否される（鍵認証のみになっている）

ここまでで `ssh exocortex "<command>"` が使えるようになった。
以降の手順は、原則としてこの形でクライアントから実行する。

## 2. サーバー（Windows/WSL2）をセットアップする

### 2.1 WSL のバージョンを確認する

systemd を使うには WSL 0.67.6 以降が必要である。

**実行**

```bash
# クライアント（SSH 経由）
ssh exocortex "wsl --version"
```

**確認**

- [ ] `WSL バージョン` の行が 0.67.6 以降になっている

古い場合は `ssh exocortex "wsl --update"` で更新する。

コマンド自体が認識されない場合、WSL が Microsoft Store 版ではなく古い Windows コンポーネント版である。
`ssh exocortex "wsl --update"` で Store 版に移行してから先に進む。

### 2.2 ディストロを選ぶ

まだ WSL にディストロがない場合は新たに作る。
すでに WSL ディストロがある場合はそこに exocortex をセットアップしても良い。
あるいは exocortex 専用のディストロを新たに用意しても構わない。

**実行**

手元のディストロを確認する。

```bash
# クライアント（SSH 経由）
ssh exocortex "wsl -l -v"
```

一覧にあるディストロの `NAME` が `<distro>` である。
Docker と systemd をこれから導入するので、まだ何も入っていないディストロでも構わない。

> **Tips** モデルは `qwen3:14b` と `translategemma:12b` の 2 本で 16GB を超え、Docker のイメージと
> ビルドキャッシュも加わる。C: の空き容量が気になる場合は、別ドライブに専用のディストロを新設する
> という選択肢もある。
> なおその場合は、 NVMe 接続の十分に早い SSD を選ぶことを推奨する
>
> ```powershell
> # 管理者 PowerShell
> wsl --install -d Ubuntu --location D:\wsl\exocortex --name exocortex
> ```
>
> `--name` を省くと、ディストロの名前はディストリビューション名（`Ubuntu`）になる[^wslcmd]。
> 同じ名前のディストロがすでにある環境では `--name` で別名を選ぶ。

### 2.3 systemd を有効にする

Docker が systemd を必要とする。

**実行**

まず現状を確認する。

```bash
# クライアント（SSH 経由）
ssh exocortex "wsl -d <distro> -- cat /etc/wsl.conf"
```

`[boot]` の下に `systemd=true` があれば、書き足すものはない。確認に進む。

無ければ追記する。

```bash
# クライアント（SSH 経由）
ssh exocortex "wsl -d <distro>"
```

```bash
# クライアント（SSH 経由、ディストロ内）
printf '[boot]\nsystemd=true\n' | sudo tee -a /etc/wsl.conf
```

編集したら WSL を再起動して反映する。

```bash
# クライアント（SSH 経由）
ssh exocortex "wsl --shutdown"
```

このコマンドは実行中のすべてのディストロを終了させる。
他のディストロで作業中であれば、巻き込まれる。

**確認**

```bash
# クライアント（SSH 経由）
ssh exocortex "wsl -d <distro> -- systemctl is-system-running"
```

- [ ] `running` または `degraded` が返っている（`degraded` は一部のユニットが失敗している状態だが、Docker の導入には支障ない）

`System has not been booted with systemd` が返る場合、`wsl --shutdown` が効いていないか、`wsl.conf` の書式が誤っている。

### 2.4 networking を mirrored にする

WSL2 は既定で NAT モードのため、クライアントから到達できない[^wsl-networking]。

**実行**

`C:\Users\<windows-user>\.wslconfig` を作る。
サーバー側のファイルであり `<distro>` の中からは編集できないため、この手順はサーバーの前で行う。

```powershell
# PowerShell
Set-Content -Path $env:USERPROFILE\.wslconfig -Value "[wsl2]`nnetworkingMode=mirrored`nmemory=12GB"
wsl --shutdown
```

`memory` の既定はホスト RAM の 50% である。
このサーバーを他の用途にも使うなら、上限を切っておく。
Ollama がモデルファイルを読んで VRAM に転送する間のピークに、Docker と OS の分を足すと 12GB で足りる。
搭載 32GB の環境で、サーバー側に 19GB 残る配分である。

この設定は WSL2 の VM 全体に効く。
ディストロごとに分ける手段はないため、既存のディストロの通信にも影響する。

**確認**

```bash
# クライアント（SSH 経由）
ssh exocortex "wsl -d <distro> -- ip addr show"
```

- [ ] サーバー側のネットワークインターフェイスと同じアドレスが見えている（mirrored が効いている）

**うまくいかないとき**

既存のディストロや VPN の通信が壊れた場合は、`.wslconfig` から `networkingMode` の行を削除し、`wsl --shutdown` で戻す。
この手順は既存環境に影響する唯一の箇所なので、戻し方を先に把握しておく。

### 2.5 Hyper-V ファイアウォールで受信を許可する

mirrored モードでは、Hyper-V ファイアウォールが受信を既定で遮る。
管理者権限の昇格を伴う操作なので、この手順だけはサーバーの前で行う。

**実行**

```powershell
# 管理者 PowerShell
Set-NetFirewallHyperVVMSetting -Name '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}' -DefaultInboundAction Allow
```

**確認**

```powershell
# 管理者 PowerShell
Get-NetFirewallHyperVVMSetting -Name '{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}'
```

- [ ] `DefaultInboundAction` が `Allow` になっている

### 2.6 Docker Engine を導入する

Docker Desktop は使わない。
公式の apt リポジトリから Docker Engine を入れる[^docker]。

**実行**

ディストロのシェルに入る。

```bash
# クライアント（SSH 経由）
ssh exocortex "wsl -d <distro>"
```

以降はそのシェルの中で実行する。

先にディストロ全体を更新する。

```bash
# クライアント（SSH 経由、ディストロ内）
sudo apt update
sudo apt full-upgrade
```

更新にライブラリや systemd が含まれた場合は、ディストロを入れ直す。
WSL のカーネルはサーバー側が提供するため、ここでカーネルが更新されることはない。
いったんシェルを抜け、クライアントから次を実行する。

```bash
# クライアント（SSH 経由）
ssh exocortex "wsl --terminate <distro>"
ssh exocortex "wsl -d <distro>"
```

続いて Docker の apt リポジトリを登録する。

```bash
# クライアント（SSH 経由、ディストロ内）
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

```bash
# クライアント（SSH 経由、ディストロ内）
sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

`sudo` なしで docker を使えるようにする[^postinstall]。

```bash
# クライアント（SSH 経由、ディストロ内）
sudo usermod -aG docker $USER
```

グループの変更は、入り直すまで反映されない。
シェルを抜け、クライアントから入り直す。

```bash
# クライアント（SSH 経由）
ssh exocortex "wsl --terminate <distro>"
ssh exocortex "wsl -d <distro>"
```

公式の手順にある `newgrp docker` でも反映できるが、WSL の Ubuntu イメージには `newgrp` が入っていないことがある。
入り直すほうが確実である。

サーバーの再起動後にも Docker が上がるよう、サービスを有効にする。

```bash
# クライアント（SSH 経由、ディストロ内）
sudo systemctl enable --now docker
```

**確認**

```bash
# クライアント（SSH 経由、ディストロ内）
docker run --rm hello-world
```

- [ ] `Hello from Docker!` が表示される

`permission denied` が出る場合は、入り直しが済んでいない。
`ssh exocortex "wsl --terminate <distro>"` をもう一度実行してから試す。

### 2.7 nvidia-container-toolkit を導入する

コンテナから GPU を使うために必要である[^nvidia]。

**実行**

ディストロのシェルに入る。

```bash
# クライアント（SSH 経由）
ssh exocortex "wsl -d <distro>"
```

```bash
# クライアント（SSH 経由、ディストロ内）
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt update
sudo apt install -y nvidia-container-toolkit
```

```bash
# クライアント（SSH 経由、ディストロ内）
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

`/etc/docker/daemon.json` がまだ無い状態では、`Config file does not exist; using empty config` が出る。
新規に導入した直後であれば、これが既定の状態である。
`Wrote updated config to /etc/docker/daemon.json` が続いていれば設定は書けている。

**確認**

```bash
# クライアント（SSH 経由、ディストロ内）
docker run --rm --gpus all ubuntu nvidia-smi
```

- [ ] GPU の名前と VRAM 容量が表示される（コンテナから GPU が見えている）

`nvidia-ctk runtime configure` の後に Docker を再起動し忘れていないかを確認する。
それでも失敗する場合、ディストロの中に Linux 用の GPU ドライバを入れてしまっていないかを見る。
WSL2 ではサーバー側のドライバを共有するため、Linux 側にドライバを入れると衝突する。

### 2.8 リポジトリを clone する

**実行**

clone 先はディストロの中のホームディレクトリにする。
`/mnt/c` や `/mnt/d` に置くと、サーバーのファイルシステムを経由するぶん遅くなる。

このマシンは推論サーバーとして動かすだけで、ここから commit することはない。
更新も `git pull` で足りるため、HTTPS で clone し、SSH 鍵を設定する必要はない。

```bash
# クライアント（SSH 経由）
ssh exocortex "wsl -d <distro>"
```

```bash
# クライアント（SSH 経由、ディストロ内）
cd ~
git clone https://github.com/haribote/exocortex.git
cd exocortex
ls docker-compose.yml
```

**確認**

- [ ] `docker-compose.yml` の一覧が表示される

`.env` は作らなくて構わない。
モデル名を既定から変えたいときだけ `.env.example` を写して使う。
認証は SSH の公開鍵に委ねる（1 章ですでに完了している）。

### 2.9 起動してモデルを取得する

**実行**

以降、ディストロ内で `~/exocortex` に `cd` した状態が続く。

```bash
# クライアント（SSH 経由、ディストロ内）
docker compose up -d
docker compose exec ollama ollama pull qwen3:14b
docker compose exec ollama ollama pull translategemma:12b
```

2 本あわせて 16GB を超えるため、回線によっては時間がかかる。
途中で止まった場合は同じコマンドを再実行すると再開する。

**確認**

```bash
# クライアント（SSH 経由、ディストロ内）
docker compose ps
docker compose exec ollama ollama list
```

- [ ] `ollama` と `ai-api` の両方が `running` になっている
- [ ] モデルが 2 本並んでいる

```bash
# クライアント（SSH 経由、ディストロ内）
curl http://localhost:11435/health
```

- [ ] ディストロの中から `/health` が返る（`ai-api` が動いている）

### 2.10 VRAM の割り当てを確認する

**実行**

レビューを 1 回投げてモデルをロードさせる。

```bash
# クライアント（SSH 経由、ディストロ内）
curl -X POST http://localhost:11435/review \
  -H 'Content-Type: application/json' \
  -d '{"language":"typescript","diff":"diff --git a/a.ts b/a.ts\n+const x = 1\n"}'
docker compose exec ollama ollama ps
```

**確認**

- [ ] `CONTEXT` が 32768 になっている
- [ ] `PROCESSOR` が `100% GPU` になっている（`100% CPU` や部分ロードは VRAM に収まっていない状態）

この確認はセットアップ時の一度きりではない。
`ollama ps` の `PROCESSOR` 列は、稼働中も定期的に見る価値がある。

## 3. Claude Code skill を導入する

クライアント側の Claude Code から推論サーバーの機能を呼び出すための skill は以下よりコピーできる。

**実行**

```bash
# クライアント
mkdir -p ~/.claude/skills/exoc-review ~/.claude/skills/exoc-translate
curl -fsSL https://raw.githubusercontent.com/haribote/dotfiles/master/.claude/skills/exoc-review/SKILL.md -o ~/.claude/skills/exoc-review/SKILL.md
curl -fsSL https://raw.githubusercontent.com/haribote/dotfiles/master/.claude/skills/exoc-translate/SKILL.md -o ~/.claude/skills/exoc-translate/SKILL.md
```

ソースは次のとおり。

- exoc-review：https://github.com/haribote/dotfiles/blob/master/.claude/skills/exoc-review/SKILL.md
- exoc-translate：https://github.com/haribote/dotfiles/blob/master/.claude/skills/exoc-translate/SKILL.md

**確認**

- [ ] Claude Code のセッションで skill 一覧に `exoc-review` と `exoc-translate` が現れる

セットアップは以上。
各種機能の使い方は [`how-to-use.md`](./how-to-use.md) に記す。

## 撤収とやり直し

Docker のデータルート、イメージ、Ollama の named volume はすべてディストロの中に載っている。
セットアップからやり直すには、ディストロを登録解除する。

```powershell
# PowerShell
wsl --unregister <distro>
```

登録を解除すると、そのディストロのデータ、設定、導入したソフトウェアはすべて失われる。
専用にディストロを新設した場合に限る操作で、既存のディストロに同居させた場合はこの手順を使わない。

SSH の鍵はサーバー側の `C:\ProgramData\ssh` にあり、ディストロの登録解除では消えない。
`.wslconfig` も VM 全体の設定であり、ディストロの登録解除では消えない。
mirrored モードをやめる場合は、`networkingMode` の行を削除して `wsl --shutdown` する。

[^wslcmd]: [Basic commands for WSL - Microsoft Learn](https://learn.microsoft.com/en-us/windows/wsl/basic-commands)

[^docker]: [Install Docker Engine on Ubuntu - Docker Docs](https://docs.docker.com/engine/install/ubuntu/)

[^postinstall]: [Linux post-installation steps for Docker Engine - Docker Docs](https://docs.docker.com/engine/install/linux-postinstall/)

[^nvidia]: [Installing the NVIDIA Container Toolkit - NVIDIA Docs](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)

[^openssh-install]: [Get started with OpenSSH Server for Windows - Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse)

[^openssh-keys]: [Key-Based Authentication in OpenSSH for Windows - Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_keymanagement)

[^wsl-networking]: [Accessing network applications with WSL - Microsoft Learn](https://learn.microsoft.com/en-us/windows/wsl/networking)
