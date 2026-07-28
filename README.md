# Taya

Taya is a real engineering assistant built from native [Pi](https://pi.dev) sessions, [Herdr](https://herdr.dev), and [herdr-workboard](https://github.com/Phoobobo/herdr-workboard).

The project is at the first vertical-slice stage. Current commands initialize the user-owned `~/.taya` workspace, inspect runtime dependencies, recommend a configured Work Directory, create an independent Workboard workspace, start a deterministic supervisor, initialize the selected workflow, and launch the primary assistant as a native Pi TUI inside Herdr.

## Requirements

- macOS
- Node.js 22.19+
- Pi
- Herdr
- herdr-workboard Herdr plugin

## Development

```bash
npm install
npm run build
npm test

TAYA_HOME=/tmp/taya-profile node dist/cli.js init
TAYA_HOME=/tmp/taya-profile node dist/cli.js workdir add "$PWD"
TAYA_HOME=/tmp/taya-profile node dist/cli.js doctor
TAYA_HOME=/tmp/taya-profile node dist/cli.js --dry-run --yes
```

Install Workboard when missing. The workflow CLI currently also requires a linked checkout:

```bash
git clone https://github.com/Phoobobo/herdr-workboard.git
cd herdr-workboard
bun install
bun link
herdr plugin link "$PWD"
```

See [the product specification](docs/product-spec.md) and [architecture](docs/architecture.md).
