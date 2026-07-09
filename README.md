# T3 Code

T3 Code is a minimal web GUI for coding agents (currently Codex, Claude, Cursor, and OpenCode, more coming soon).

## Installation

> [!WARNING]
> T3 Code currently supports Codex, Claude, Cursor, and OpenCode.
> Install and authenticate at least one provider before use:
>
> - Codex: install [Codex CLI](https://developers.openai.com/codex/cli) and run `codex login`
> - Claude: install [Claude Code](https://claude.com/product/claude-code) and run `claude auth login`
> - Cursor: install [Cursor CLI](https://cursor.com/cli) and run `cursor-agent login`
> - OpenCode: install [OpenCode](https://opencode.ai) and run `opencode auth login`

### Run without installing

```bash
npx t3@latest
```

Tip: Use `npx t3@latest --help` for the full CLI reference.

### Desktop app

Install the latest version of the desktop app from [GitHub Releases](https://github.com/pingdotgg/t3code/releases), or from your favorite package registry:

#### Windows (`winget`)

```bash
winget install T3Tools.T3Code
```

#### macOS (Homebrew)

```bash
brew install --cask t3-code
```

#### Arch Linux (AUR)

```bash
yay -S t3code-bin
```

## Install (Desktop App)

> [!WARNING]
> All install methods below require [Codex CLI](https://github.com/openai/codex) to be installed and authorized **separately**. T3 Code is a GUI frontend — it does not bundle Codex.

### macOS

**Option 1: Homebrew Cask**

```bash
# Clone the repo and install the cask
git clone https://github.com/pingdotgg/t3code.git
brew install --cask ./t3code/packaging/homebrew/Casks/t3code.rb
```

**Option 2: Direct download**

Download the `.dmg` for your Mac from [Releases](https://github.com/pingdotgg/t3code/releases):
- **Apple Silicon (M1/M2/M3/M4):** `T3-Code-<version>-arm64.dmg`
- **Intel:** `T3-Code-<version>-x64.dmg`

Open the `.dmg` and drag T3 Code to your Applications folder.

### Arch Linux

```bash
git clone https://github.com/pingdotgg/t3code.git
cd t3code/packaging/arch
makepkg -si
```

This builds and installs the `t3code-bin` package from the PKGBUILD, which downloads the pre-built AppImage from GitHub Releases.

### Linux (Ubuntu / Debian / Others)

There is no `.deb` package yet. The recommended Linux install path is the AppImage:

```bash
curl -LO "https://github.com/pingdotgg/t3code/releases/download/v0.0.3/T3-Code-0.0.3-x86_64.AppImage"
chmod +x T3-Code-0.0.3-x86_64.AppImage
./T3-Code-0.0.3-x86_64.AppImage
```

> **Note:** AppImage requires FUSE. On Ubuntu 22.04+: `sudo apt install libfuse2`

## Some notes

We are very very early in this project. Expect bugs.

We are not accepting contributions yet.

There's no public docs site yet, checkout the miscellaneous markdown files in [docs](./docs).

## Documentation

- [Getting started](./docs/getting-started/quick-start.md)
- [Architecture overview](./docs/architecture/overview.md)
- [Provider guides](./docs/providers/codex.md)
- [Operations](./docs/operations/ci.md)
- [Reference](./docs/reference/encyclopedia.md)

## If you REALLY want to contribute still.... read this first

### Install `vp`

T3 Code uses Vite+ so you'll need to install the global `vp` command-line tool.

#### macOS / Linux

```bash
curl -fsSL https://vite.plus | bash
```

#### Windows

```bash
irm https://vite.plus/ps1 | iex
```

Checkout their getting started guide for more information: https://viteplus.dev/guide/

### Install dependencies

```bash
vp i
```

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening an issue or PR.

Need support? Join the [Discord](https://discord.gg/jn4EGJjrvv).
