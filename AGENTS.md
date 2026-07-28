# AGENTS.md

Guidance for agents working in this repository.

## Project

Taya ("true assistant") is an ESM npm package that composes Pi, Herdr, and herdr-workboard through their public CLIs to run one primary engineering assistant plus professional agent profiles (architect, coder, QA) in native Pi TUI panes. The MVP targets macOS + Node.js 22.19+.

- Product spec: `docs/product-spec.md`
- Architecture: `docs/architecture.md`
- Entry point: `src/cli.ts` (installed as the `taya` bin)

## Commands

```bash
npm install
npm run build      # tsc -> dist/
npm test           # vitest run
npm run typecheck  # tsc --noEmit
npm run dev        # tsx src/cli.ts
```

Local exercise of the CLI:

```bash
TAYA_HOME=/tmp/taya-profile node dist/cli.js init
TAYA_HOME=/tmp/taya-profile node dist/cli.js workdir add "$PWD"
TAYA_HOME=/tmp/taya-profile node dist/cli.js doctor
TAYA_HOME=/tmp/taya-profile node dist/cli.js --dry-run --yes
```

## Layout

- `src/cli.ts` — subcommands: `init`, `workdir add`, `doctor`, `start` (default), `assistant`, `supervise`.
- `src/config/` — `~/.taya` layout, initialization, YAML load, path resolution.
- `src/herdr/client.ts` — Herdr CLI wrapper (workspaces, named panes, `runInPane`).
- `src/workboard/client.ts` — herdr-workboard CLI wrapper.
- `src/workdirs/` — local Work Directory registration, optional delivery-provider detection, and recommendation.
- `src/supervisor.ts` — deterministic (non-LLM) supervisor loop.
- `src/protocol/` — `[TAYA-MSG]` JSON+Markdown protocol (`message.ts`, `messenger.ts`).
- `src/dependencies.ts` — detects `pi`, `herdr`, `phoobobo.workboard`, `gh`, `bitscli`.
- `resources/` — packaged defaults for `~/.taya` (`agents/`, `prompts/`, `skills/`, `workflows/`).
- `tests/` — vitest suites mirroring `src/` modules.

## Conventions

- ESM only (`"type": "module"`); use `.js` import specifiers for TS sources.
- Node built-ins imported as `node:*`.
- Prefer editing existing files; do not create new modules or docs unless required.
- No secrets under `~/.taya`; Pi owns model auth.
- Do not persist Herdr pane IDs; resolve panes by role name inside the workspace.
- Do not read Herdr or Workboard internal storage; call their CLIs only.
- Only the primary assistant routes business messages between agents; supervisor reports facts, does not decide.
- Inter-pane messages follow the `[TAYA-MSG] { ... } ... [/TAYA-MSG]` format defined in `docs/architecture.md`.

## Testing

- Framework: vitest. Place new tests next to existing ones in `tests/` using the `<module>.test.ts` pattern.
- Run the full suite with `npm test` before finishing a change.
- Keep tests hermetic: use `TAYA_HOME` in a temp dir when exercising config code, and stub external CLIs (`pi`, `herdr`, `herdr-workboard`, `gh`, `bitscli`).

## Scope discipline

- MVP only. Deferred items (stacked MRs, multi-repo tasks, Botmux, profile evolution, hard sandboxes) stay out unless explicitly requested.
- Prompt-level role restrictions only; do not add filesystem/command isolation.
- One Herdr session `taya`; one workspace per task; one worktree; one MR.
