# AGENTS.md

This repository is a bun workspace monorepo. Work inside the package you are changing and follow its own guide:

- `packages/taya-cli/AGENTS.md` — the `taya` CLI (Node.js ≥ 22.19, vitest).
- `packages/herdr-bot/README.md` — the herdr-bot Herdr plugin (bun, `bun test`).

Install dependencies once from the repository root with `bun install` (single `bun.lock`). Run a package's tests from its own directory. herdr-bot tests use a fake herdr via `HERDR_BIN_PATH`; never point tests at a live Herdr session.
