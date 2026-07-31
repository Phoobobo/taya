# Taya

Taya is a real engineering assistant built from native [Pi](https://pi.dev) sessions, [Herdr](https://herdr.dev), and [herdr-workboard](https://github.com/Phoobobo/herdr-workboard).

The project is at the first vertical-slice stage. Current commands initialize the user-owned `~/.taya` workspace, inspect runtime dependencies, recommend a configured Work Directory, create an independent Workboard workspace, start a deterministic supervisor, initialize the selected workflow, and launch the primary assistant as a native Pi TUI inside Herdr.

## Requirements

- macOS
- Node.js 22.19+
- Pi
- Herdr
- herdr-workboard Herdr plugin

## Configuration

`~/.taya` holds your configuration. Most of it is written once by `taya init` and is yours to edit.

Prompt templates and skills work differently: they are **not** copied into `~/.taya`. Taya resolves them from the installed package, so an upgrade reaches you without a merge step and a broken file cannot leave you without a command.

The rule is: **a name you have explicitly overridden is yours; everything else comes from the package and stays current.** Taya loads both directories and merges them by name, with yours taking precedence:

| `~/.taya/prompt-templates/` | Package | Result |
| --- | --- | --- |
| *(empty)* | `pick` | `/pick` — the shipped default |
| `standup` | `pick` | `/pick` and `/standup` — both available |
| `standup`, `pick` | `pick` | `/standup`, and **your** `/pick` |

So adding a template of your own does not cost you the shipped ones, and overriding one does not freeze the rest. Deleting an override returns that name to the default.

To change one, copy it into `~/.taya` and edit it there:

```bash
mkdir -p ~/.taya/prompt-templates
cp "$(npm root -g)/taya/resources/prompt-templates/pick.md" ~/.taya/prompt-templates/
```

`pick.md` is the interesting one: it defines where Taya looks for new work. Point it at whatever holds your backlog. Delete your copy to fall back to the shipped default.

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
