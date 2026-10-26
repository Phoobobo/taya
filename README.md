# Taya monorepo

Taya is a local, transparent engineering execution layer that runs in Herdr. This repository is a bun workspace (`packages/*`):

| Package | Path | Runtime | Tests |
| --- | --- | --- | --- |
| `taya` (CLI, npm package) | [`packages/taya-cli`](packages/taya-cli) | Node.js ≥ 22.19 | `vitest run` |
| `herdr-bot` (Herdr plugin `phoobobo.herdr-bot`) | [`packages/herdr-bot`](packages/herdr-bot) | bun | `bun test` |

`packages/herdr-bot` was imported from `Phoobobo/herdr-bot` with `git subtree` and keeps its full history.

## Development

```bash
bun install            # one lockfile (bun.lock) for all packages
bun run test           # run every package's tests

cd packages/taya-cli && bun run test   # vitest under Node
cd packages/herdr-bot && bun test
```

Roadmap: [`docs/roadmap.md`](docs/roadmap.md) (once merged).
