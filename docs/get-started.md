# Get started

Windows マシンを exocortex の推論サーバーとして立ち上げ、Mac から使える状態にするまでの手順です。

SSH 接続の確立を最初の章に置きます。
一度 `ssh exocortex` が通れば、それ以降の Windows/WSL2 側のセットアップは Mac から `ssh exocortex "<command>"` の形でそのまま進められます。
Windows の前に戻って操作する場面は、SSH 接続そのものを成立させる 1 章と、ひとまとまりのファイル編集を伴う一部の手順に限られます。

## この文書の読み方

### プレースホルダ

環境ごとに変わる値は、山括弧で囲んだ小文字の語で示します。

| プレースホルダ | 意味 | 取得方法 |
|---|---|---|
| `<windows-ip>` | Windows マシンの LAN 内 IPv4 アドレス | 2.1 節の `ipconfig` |
| `<windows-user>` | Windows のユーザー名 | `C:\Users` の下にあるディレクトリ名 |
| `<linux-user>` | ディストロの中の UNIX ユーザー名 | 既存のディストロならすでに決まっている値、新設するなら初回起動時に自分で決める |
| `<distro>` | セットアップ先の WSL ディストロ名 | 既存のディストロを使うならその名前、新設するなら 2.2 節で決める |
| `<public-key>` | Mac で生成した SSH 公開鍵の中身 | 1.1 節の `cat ~/.ssh/exocortex_ed25519.pub` |

置き換えるときは山括弧ごと置き換えます。
`<` と `>` を残しません。

手順 2.5 に出てくる GUID `{40E0AC32-46A5-438A-A0B2-2B479E8F2E90}` はプレースホルダではありません。
WSL に固定で割り当てられた既知の値なので、そのまま入力します。

### コマンドの実行場所

コードブロックの先頭のコメントが、どこで実行するかを示します。

- `Mac`：Mac のシェルで直接実行する
- `Mac（SSH 経由）`：Mac から `ssh exocortex "<command>"` の形で、1 コマンドとして実行する
- `Mac（SSH 経由、ディストロ内）`：`ssh exocortex "wsl -d <distro>"` でディストロのシェルに入ってから実行する。複数行にわたる、または引用符が入れ子になる手順はこの形を使う。1 コマンドに詰め込んでエスケープを重ねるより、ログインしてそのまま打つほうが事故りにくい
- `PowerShell` / `管理者 PowerShell`：Windows の前で実行する。SSH 接続を確立するまでの一部の手順と、ファイル編集を伴う一部の手順に限られる

各手順は「実行」「確認」の順に並びます。
期待する出力を載せている箇所がありますが、これは版によって揺れます。
判定の基準になるのは、出力そのものではなく、添えてある散文の条件のほうです。

## 前提

| 項目 | 必要な条件 |
|---|---|
| GPU | NVIDIA 製、VRAM 16GB 以上（想定は RTX 5080） |
| NVIDIA ドライバ | 550 以降 |
| Windows | Windows 11 22H2 以降（`networkingMode=mirrored` の要件） |
| 仮想化 | BIOS/UEFI で有効 |
| 権限 | 管理者権限を使える |
| ディスクの空き容量 | 60GB 以上（モデル 2 本で 16GB、Docker のイメージとビルドキャッシュを含む） |
| ネットワーク | Mac と Windows が同一 LAN にある |

ドライバの導入手順はこの文書には含めません。

WSL の中に GPU ドライバを入れる必要はありません。
WSL2 は Windows 側のドライバを共有します。

## 1. SSH 接続を確立する

### 1.1 Mac 側で鍵ペアを作る

exocortex 専用の鍵ペアを作ります。
GitHub 用など他の鍵と混ぜません。

**実行**

```bash
# Mac
ssh-keygen -t ed25519 -f ~/.ssh/exocortex_ed25519 -C "exocortex-windows"
```

`~/.ssh/config` にホストエイリアスを足しておくと、以降は `ssh exocortex` だけで繋がります。

```
Host exocortex
  HostName <windows-ip>
  User <windows-user>
  IdentityFile ~/.ssh/exocortex_ed25519
  IdentitiesOnly yes
```

**確認**

```bash
# Mac
cat ~/.ssh/exocortex_ed25519.pub
```

この内容が `<public-key>` です。以降の手順で使うので控えておきます。

### 1.2 OpenSSH Server を導入する

一次ソースは Microsoft Learn の [OpenSSH Server 導入手順](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse)です[^openssh-install]。

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

`Enabled` が `True` であれば、ファイアウォールルールは導入時に自動作成されています。

### 1.3 公開鍵を配置する

配置先は `<windows-user>` が Administrators グループに属すかどうかで変わります[^openssh-keys]。
個人機の既定アカウントは Administrators に属していることがほとんどです。

**Administrators への所属確認**

```powershell
# PowerShell（管理者権限は不要）
(Get-LocalGroupMember -Group "Administrators").Name -contains "$env:COMPUTERNAME\$env:USERNAME"
```

> **注意** `(New-Object Security.Principal.WindowsPrincipal(...)).IsInRole(...)` でも同じことを確認できますが、
> 非昇格の PowerShell では UAC によるトークン分割のせいで、実際は Administrators のメンバーでも `False` を返します。
> 上記の `Get-LocalGroupMember` は昇格の有無に影響されません。

`True` の場合は `administrators_authorized_keys` に置きます。
このファイルは Administrators と SYSTEM だけが読めるよう ACL を絞る必要があります。

**実行（Administrators に属す場合）**

```powershell
# 管理者 PowerShell
Add-Content -Force -Path C:\ProgramData\ssh\administrators_authorized_keys -Value '<public-key>'
icacls.exe "C:\ProgramData\ssh\administrators_authorized_keys" /inheritance:r /grant "Administrators:F" /grant "SYSTEM:F"
```

**実行（属さない場合）**

```powershell
# PowerShell
New-Item -Force -ItemType Directory -Path $env:USERPROFILE\.ssh
Add-Content -Force -Path $env:USERPROFILE\.ssh\authorized_keys -Value '<public-key>'
```

**確認**

該当するファイルを `Get-Content` で開き、公開鍵が 1 行だけ、途中で改行されずに入っていることを見ます。

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

`PasswordAuthentication no` と `PubkeyAuthentication yes` の両方が出ていれば設定できています。

### 1.5 LAN 内からだけ port 22 に届くようにする

Windows の既定はネットワーク プロファイルを `Public` のままにし、必要なポートだけピンポイントで
開けることを勧めています。
ネットワーク全体を `Private` に変えると、ネットワーク検出やファイル共有まで有効になり、
SSH を通したいだけの目的に対して余計な露出が増えます。
そのため `OpenSSH-Server-In-TCP` ルールだけを、同一LANのサブネットに限りどのプロファイルでも
許可する形に絞ります。

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

`RemoteAddress` が `LocalSubnet` になっていること、`NetworkCategory` は変えていないこと
（`Public` のままで構わないこと）を確かめます。

**うまくいかないとき**

Mac から port 22 が繋がらない（`Operation timed out`）のに、Windows のローカルからは
`Test-NetConnection -ComputerName localhost -Port 22` が成功する場合、ファイアウォールルールの
`Profile` と実際の `NetworkCategory` が食い違っています。
`Get-NetFirewallRule -Name OpenSSH-Server-In-TCP | Get-NetFirewallProfile` で、ルールが
今のネットワークプロファイルに適用される設定になっているかを確認します。

### 1.6 SSH 接続を確認する

**実行**

初回接続なので、`known_hosts` に登録する前に本物の Windows マシンに繋がっているかを確かめます。

```bash
# Mac
ssh-keyscan -t ed25519 <windows-ip>
```

```powershell
# 管理者 PowerShell（ホスト鍵は Administrators/SYSTEM のみ読める ACL のため管理者権限が要る）
Get-Content C:\ProgramData\ssh\ssh_host_ed25519_key.pub
```

両方の鍵の実体（`ssh-ed25519 AAAA...` の部分）が一致していれば、正しい相手です。

```bash
# Mac
ssh exocortex "echo ok"
```

**確認**

パスワード認証が無効になっていることを確かめます。

```bash
# Mac
ssh -o PreferredAuthentications=password -o PubkeyAuthentication=no exocortex "echo should-fail"
```

パスワードの入力を求められずに拒否されれば、鍵認証のみになっています。

ここまでで `ssh exocortex "<command>"` が使えるようになりました。
以降の手順は、原則としてこの形で Mac から実行します。

## 2. Windows/WSL2 側をセットアップする

### 2.1 WSL のバージョンを確認する

systemd を使うには WSL 0.67.6 以降が必要です。

**実行**

```bash
# Mac（SSH 経由）
ssh exocortex "wsl --version"
```

**確認**

`WSL バージョン` の行が 0.67.6 以降であれば、この先の手順が通ります。
古い場合は `ssh exocortex "wsl --update"` で更新します。

コマンド自体が認識されない場合、WSL が Microsoft Store 版ではなく古い Windows コンポーネント版です。
`ssh exocortex "wsl --update"` で Store 版に移行してから先に進みます。

### 2.2 ディストロを選ぶ

exocortex は、すでにある WSL ディストロにセットアップしてかまいません。
用途ごとにディストロを分けるかどうかは、ディスクの構成やその他の用途との兼ね合いで決まるもので、この文書が強制するものではありません。

**実行**

手元のディストロを確認します。

```bash
# Mac（SSH 経由）
ssh exocortex "wsl -l -v"
```

一覧にあるディストロの `NAME` が `<distro>` です。
Docker と systemd をこれから導入するので、まだ何も入っていないディストロでも構いません。

> **Tips** モデルは `qwen3:14b` と `translategemma:12b` の 2 本で 16GB を超え、Docker のイメージと
> ビルドキャッシュも加わります。C: の空き容量が気になる場合は、別ドライブに専用のディストロを新設する
> という選択肢もあります。
>
> ```powershell
> # 管理者 PowerShell
> wsl --install -d Ubuntu --location D:\wsl\exocortex --name exocortex
> ```
>
> `--name` を省くと、ディストロの名前はディストリビューション名（`Ubuntu`）になります[^wslcmd]。
> 同じ名前のディストロがすでにある環境では `--name` で別名を選びます。
> `--location` が使えない場合は `wsl --import exocortex D:\wsl\exocortex <rootfs-tar> --version 2` を使います。

### 2.3 systemd を有効にする

Docker が systemd を必要とします。

**実行**

まず現状を確認します。

```bash
# Mac（SSH 経由）
ssh exocortex "wsl -d <distro> -- cat /etc/wsl.conf"
```

`[boot]` の下に `systemd=true` があれば、書き足すものはありません。確認に進みます。

無ければ追記します。

```bash
# Mac（SSH 経由）
ssh exocortex "wsl -d <distro>"
```

```bash
# Mac（SSH 経由、ディストロ内）
printf '[boot]\nsystemd=true\n' | sudo tee -a /etc/wsl.conf
```

編集したら WSL を再起動して反映します。

```bash
# Mac（SSH 経由）
ssh exocortex "wsl --shutdown"
```

このコマンドは実行中のすべてのディストロを終了させます。
他のディストロで作業中であれば、巻き込まれます。

**確認**

```bash
# Mac（SSH 経由）
ssh exocortex "wsl -d <distro> -- systemctl is-system-running"
```

`running` または `degraded` が返れば systemd が動いています。
`degraded` は一部のユニットが失敗している状態ですが、Docker の導入には支障ありません。

`System has not been booted with systemd` が返る場合、`wsl --shutdown` が効いていないか、`wsl.conf` の書式が誤っています。

### 2.4 networking を mirrored にする

WSL2 は既定で NAT モードのため、Mac から到達できません[^wsl-networking]。

**実行**

`C:\Users\<windows-user>\.wslconfig` を作ります。
Windows 側のファイルであり `<distro>` の中からは編集できないため、この手順は Windows の前で行います。

```powershell
# PowerShell
Set-Content -Path $env:USERPROFILE\.wslconfig -Value "[wsl2]`nnetworkingMode=mirrored`nmemory=12GB"
wsl --shutdown
```

`memory` の既定はホスト RAM の 50% です。
このマシンを Windows 側でも使うなら、上限を切っておきます。
Ollama がモデルファイルを読んで VRAM に転送する間のピークに、Docker と OS の分を足すと 12GB で足ります。
搭載 32GB の環境で、Windows 側に 19GB 残る配分です。

この設定は WSL2 の VM 全体に効きます。
ディストロごとに分ける手段はないため、既存のディストロの通信にも影響します。

**確認**

```bash
# Mac（SSH 経由）
ssh exocortex "wsl -d <distro> -- ip addr show"
```

Windows 側のネットワークインターフェイスと同じアドレスが見えていれば、mirrored が効いています。

**うまくいかないとき**

既存のディストロや VPN の通信が壊れた場合は、`.wslconfig` から `networkingMode` の行を削除し、`wsl --shutdown` で戻します。
この手順は既存環境に影響する唯一の箇所なので、戻し方を先に把握しておきます。

### 2.5 Hyper-V ファイアウォールで受信を許可する

mirrored モードでは、Hyper-V ファイアウォールが受信を既定で遮ります。
管理者権限の昇格を伴う操作なので、この手順だけは Windows の前で行います。

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

`DefaultInboundAction` が `Allow` であれば設定できています。

### 2.6 Docker Engine を導入する

Docker Desktop は使いません。
公式の apt リポジトリから Docker Engine を入れます[^docker]。

**実行**

ディストロのシェルに入ります。

```bash
# Mac（SSH 経由）
ssh exocortex "wsl -d <distro>"
```

以降はそのシェルの中で実行します。

先にディストロ全体を更新します。

```bash
# Mac（SSH 経由、ディストロ内）
sudo apt update
sudo apt full-upgrade
```

更新にライブラリや systemd が含まれた場合は、ディストロを入れ直します。
WSL のカーネルは Windows 側が提供するため、ここでカーネルが更新されることはありません。
いったんシェルを抜け、Mac から次を実行します。

```bash
# Mac（SSH 経由）
ssh exocortex "wsl --terminate <distro>"
ssh exocortex "wsl -d <distro>"
```

続いて Docker の apt リポジトリを登録します。

```bash
# Mac（SSH 経由、ディストロ内）
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

```bash
# Mac（SSH 経由、ディストロ内）
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

`sudo` なしで docker を使えるようにします[^postinstall]。

```bash
# Mac（SSH 経由、ディストロ内）
sudo usermod -aG docker $USER
```

グループの変更は、入り直すまで反映されません。
シェルを抜け、Mac から入り直します。

```bash
# Mac（SSH 経由）
ssh exocortex "wsl --terminate <distro>"
ssh exocortex "wsl -d <distro>"
```

公式の手順にある `newgrp docker` でも反映できますが、WSL の Ubuntu イメージには `newgrp` が入っていないことがあります。
入り直すほうが確実です。

Windows の再起動後にも Docker が上がるよう、サービスを有効にします。

```bash
# Mac（SSH 経由、ディストロ内）
sudo systemctl enable --now docker
```

**確認**

```bash
# Mac（SSH 経由、ディストロ内）
docker run --rm hello-world
```

`Hello from Docker!` が表示されれば導入できています。

`permission denied` が出る場合は、入り直しが済んでいません。
`ssh exocortex "wsl --terminate <distro>"` をもう一度実行してから試します。

### 2.7 nvidia-container-toolkit を導入する

コンテナから GPU を使うために必要です[^nvidia]。

**実行**

ディストロのシェルに入ります。

```bash
# Mac（SSH 経由）
ssh exocortex "wsl -d <distro>"
```

```bash
# Mac（SSH 経由、ディストロ内）
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
sudo apt update
sudo apt install -y nvidia-container-toolkit
```

```bash
# Mac（SSH 経由、ディストロ内）
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

`/etc/docker/daemon.json` がまだ無い状態では、`Config file does not exist; using empty config` が出ます。
新規に導入した直後であれば、これが既定の状態です。
`Wrote updated config to /etc/docker/daemon.json` が続いていれば設定は書けています。

**確認**

```bash
# Mac（SSH 経由、ディストロ内）
docker run --rm --gpus all ubuntu nvidia-smi
```

GPU の名前と VRAM 容量が表示されれば、コンテナから GPU が見えています。

`nvidia-ctk runtime configure` の後に Docker を再起動し忘れていないかを確認します。
それでも失敗する場合、ディストロの中に Linux 用の GPU ドライバを入れてしまっていないかを見ます。
WSL2 では Windows 側のドライバを共有するため、Linux 側にドライバを入れると衝突します。

### 2.8 リポジトリを clone する

**実行**

clone 先はディストロの中のホームディレクトリにします。
`/mnt/c` や `/mnt/d` に置くと、Windows のファイルシステムを経由するぶん遅くなります。

このマシンは推論サーバーとして動かすだけで、ここから commit することはありません。
更新も `git pull` で足りるため、HTTPS で clone し、SSH 鍵を設定する必要はありません。

```bash
# Mac（SSH 経由）
ssh exocortex "wsl -d <distro>"
```

```bash
# Mac（SSH 経由、ディストロ内）
cd ~
git clone https://github.com/haribote/exocortex.git
cd exocortex
ls docker-compose.yml
```

**確認**

`docker-compose.yml` の一覧が表示されれば clone できています。
`.env` は作らなくて構いません。
モデル名を既定から変えたいときだけ `.env.example` を写して使います。
認証は SSH の公開鍵に委ねます（1 章ですでに完了しています）。

### 2.9 起動してモデルを取得する

**実行**

以降、ディストロ内で `~/exocortex` に `cd` した状態が続きます。

```bash
# Mac（SSH 経由、ディストロ内）
docker compose up -d
docker compose exec ollama ollama pull qwen3:14b
docker compose exec ollama ollama pull translategemma:12b
```

2 本あわせて 16GB を超えるため、回線によっては時間がかかります。
途中で止まった場合は同じコマンドを再実行すると再開します。

**確認**

```bash
# Mac（SSH 経由、ディストロ内）
docker compose ps
docker compose exec ollama ollama list
```

`ollama` と `ai-api` の両方が `running` で、モデルが 2 本並んでいれば成功です。

```bash
# Mac（SSH 経由、ディストロ内）
curl http://localhost:11435/health
```

ディストロの中から `/health` が返れば、`ai-api` は動いています。

### 2.10 VRAM の割り当てを確認する

**実行**

レビューを 1 回投げてモデルをロードさせます。

```bash
# Mac（SSH 経由、ディストロ内）
curl -X POST http://localhost:11435/review \
  -H 'Content-Type: application/json' \
  -d '{"language":"typescript","diff":"diff --git a/a.ts b/a.ts\n+const x = 1\n"}'
docker compose exec ollama ollama ps
```

**確認**

`CONTEXT` が 32768 で、`PROCESSOR` が `100% GPU` であれば、モデルは VRAM に収まっています。
`100% CPU` や部分ロードになっている場合、VRAM に収まっていません。

この確認はセットアップ時の一度きりではありません。
`ollama ps` の `PROCESSOR` 列は、稼働中も定期的に見る価値があります。

### 2.11 モデルのロード時間を測る

`OLLAMA_KEEP_ALIVE` は `5m` です。
5 分アイドルが続くとモデルは VRAM から降り、次のリクエストで再ロードが挟まります。
その所要時間を測っておきます。

**実行**

```bash
# Mac（SSH 経由、ディストロ内）
sudo apt install -y jq
```

```bash
# Mac（SSH 経由、ディストロ内）
docker compose restart ollama
sleep 5

REQ='{"language":"typescript","diff":"diff --git a/a.ts b/a.ts\n+const x = 1\n"}'

echo "--- 1st (after restart) ---"
curl -s -X POST http://localhost:11435/review \
  -H 'Content-Type: application/json' \
  -d "$REQ" | jq -c '.meta'

echo "--- 2nd (model resident) ---"
curl -s -X POST http://localhost:11435/review \
  -H 'Content-Type: application/json' \
  -d "$REQ" | jq -c '.meta'
```

**確認**

2 回の `durationMs` の差がモデルのロード時間にあたります。
これは 2 回目の推論時間が 1 回目と等しいと仮定した近似で、ロード時間そのものを分離して測っているわけではありません。

## 3. Claude Code skill を導入する

`exoc-review` と `exoc-translate` は Claude Code の skill で、この repo には含まれません。
全リポジトリ横断で使う個人設定として、dotfiles 側の `~/.claude/skills/` で管理します。
導入方法は dotfiles 側の管理手順に従ってください。

**確認**

導入が済んでいれば、Claude Code のセッションで skill 一覧に `exoc-review` と `exoc-translate` が現れます。
使い方は [`how-to-use.md`](./how-to-use.md) にあります。

## 4. 疎通確認

Windows 再起動や WSL の停止のたびに、Mac から見た到達性は失われます。
最終確認として、実際に使うのと同じ経路（SSH トンネル）で疎通を確かめます。

**実行**

```bash
# Mac
curl -m 5 http://<windows-ip>:11435/health
```

**確認**

**これは失敗するのが正しい状態です。**
`ai-api` は loopback にだけ publish しているため、LAN からは到達できません。
ここで応答が返る場合、`docker-compose.yml` の `ports:` にバインドアドレスが書かれているかを確認します。

トンネルを張って叩き直します。

```bash
# Mac
ssh exocortex "wsl -d <distro> -- /bin/true"
ssh -f -N -o ExitOnForwardFailure=yes -L 11435:127.0.0.1:11435 exocortex
curl http://localhost:11435/health
```

`{"status":"ok"}` が返れば、セットアップは完了です。
終わったらトンネルを閉じます。

```bash
# Mac
pkill -f "11435:127.0.0.1:11435"
```

トンネルは張れているのに応答が返らない場合、ほぼディストロが停止しています。
idle が続くと WSL の VM ごと落ちるため、`wsl -d <distro> -- /bin/true` で起こしてから張り直します。

## 日常の操作

セットアップはここまでです。
以降は使うたびに行う操作をまとめます。

Windows を再起動すると WSL の VM が停止するため、Mac から呼んでも届きません。
`docker-compose.yml` の `restart: unless-stopped` が担保するのはコンテナの再起動だけで、自動起動は成立しません。
タスクスケジューラでログオン時に起動する方法も試しましたが、`vmIdleTimeout`（既定 60 秒）により、Docker が上がった直後に WSL の VM ごと停止することが分かっています。
`vmIdleTimeout` を延長する設定も効かなかったため、使う前に手動で起動する運用にしています。

### 起動する

```bash
# Mac（SSH 経由）
ssh exocortex "wsl -d <distro> -- /bin/true"
```

ディストロが起動すると、`systemctl enable` した Docker が上がり、コンテナが続いて起動します。
`docker compose up` を打ち直す必要はありません。

### 状態を確認する

```bash
# Mac（SSH 経由）
ssh exocortex "wsl -d <distro> -- docker ps --format \"{{.Names}} {{.Status}}\""
```

`ai-api` と `ollama` の 2 つが並べば、Mac から使える状態です。

モデルがどこに載っているかも確認できます。

```bash
# Mac（SSH 経由）
ssh exocortex "wsl -d <distro> -- bash -c 'cd ~/exocortex && docker compose exec ollama ollama ps'"
```

`PROCESSOR` が `100% GPU` でなければ、他のプロセスに VRAM を奪われています。

### 再起動する

コンテナだけを入れ直します。

```bash
# Mac（SSH 経由）
ssh exocortex "wsl -d <distro> -- bash -c 'cd ~/exocortex && docker compose restart'"
```

コードを更新したときは、イメージを作り直します。

```bash
# Mac（SSH 経由）
ssh exocortex "wsl -d <distro> -- bash -c 'cd ~/exocortex && git pull && docker compose up -d --build'"
```

### 停止する

```bash
# Mac（SSH 経由）
ssh exocortex "wsl --terminate <distro>"
```

コンテナは道連れに停止します。
`wsl --shutdown` でも止まりますが、こちらは実行中のすべてのディストロを終了させます。
他のディストロを使っているなら `--terminate` を選びます。

## 撤収とやり直し

Docker のデータルート、イメージ、Ollama の named volume はすべてディストロの中に載っています。
セットアップからやり直すには、ディストロを登録解除します。

```powershell
# PowerShell
wsl --unregister <distro>
```

登録を解除すると、そのディストロのデータ、設定、導入したソフトウェアはすべて失われます。
専用にディストロを新設した場合に限る操作で、既存のディストロに同居させた場合はこの手順を使いません。

SSH の鍵は Windows 側の `C:\ProgramData\ssh` にあり、ディストロの登録解除では消えません。
`.wslconfig` も VM 全体の設定であり、ディストロの登録解除では消えません。
mirrored モードをやめる場合は、`networkingMode` の行を削除して `wsl --shutdown` します。

[^wslcmd]: [Basic commands for WSL - Microsoft Learn](https://learn.microsoft.com/en-us/windows/wsl/basic-commands)

[^docker]: [Install Docker Engine on Ubuntu - Docker Docs](https://docs.docker.com/engine/install/ubuntu/)

[^postinstall]: [Linux post-installation steps for Docker Engine - Docker Docs](https://docs.docker.com/engine/install/linux-postinstall/)

[^nvidia]: [Installing the NVIDIA Container Toolkit - NVIDIA Docs](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)

[^openssh-install]: [Get started with OpenSSH Server for Windows - Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse)

[^openssh-keys]: [Key-Based Authentication in OpenSSH for Windows - Microsoft Learn](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_keymanagement)

[^wsl-networking]: [Accessing network applications with WSL - Microsoft Learn](https://learn.microsoft.com/en-us/windows/wsl/networking)
