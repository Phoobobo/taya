# Taya Architecture

## System boundary

Taya composes three independent systems through their public CLIs:

- **Pi** runs every LLM conversation and owns model authentication. Pi is the first of potentially several pluggable coding harnesses this design leaves room for (Claude Code, Codex, Grok); only Pi is implemented in the MVP. This is a principle-level note — no adapter interface is designed in this pass.
- **Herdr** owns the persistent terminal session, workspaces, panes, agent visibility, and inter-pane transport.
- **herdr-workboard** owns task state, workflow transition validation, persistence, CLI access, and board UI.

Taya does not read Herdr or Workboard internal storage. It does not duplicate Pi session storage.

## Taya Server vs. Taya Agent session

Taya has two kinds of process:

- **Taya Server** — persistent, one per `taya` Herdr session (not per task workspace), non-LLM. It survives across many task workspaces coming and going, and owns Workboard admission (via Taya Pick) and mechanical task-lifecycle plumbing.
- **Taya Agent primary session** — an LLM harness session (Pi today), the same kind of process as any worker pane. It is scoped per task workspace for ad-hoc tasks, or runs as a lightweight, continuous monitor for server-admitted routine tasks.

The exact internal split of responsibility inside Taya Server — whether a distinct "Supervisor" sub-component exists alongside Taya Pick, and how exactly Running-capacity admission is implemented — is an **open question**, intentionally not resolved in this pass.

## Runtime topology

There is one named Herdr session per Taya installation:

```text
herdr --session taya
```

Each engineering task gets one Herdr workspace, whether started ad-hoc by the user or admitted by Taya Pick — only the initiator differs (the user via `taya start`, or Taya Server for a routine task). Taya creates the workspace itself so `assistant` is always the first tab, then attaches Workboard without reordering existing tabs. Panes have stable role names within that workspace:

```text
assistant  # first tab
workboard
supervisor
executor
reviewer
```

The heavier opt-in workflow (`coding-standard.yaml`) uses `architect`, `coder`, and `qa` panes instead of `executor`/`reviewer`.

Taya resolves panes by name before sending. Herdr pane IDs are runtime details and must not be persisted.

The workspace is the task boundary. It has one Workboard task, one Git worktree, and one MR.

## Configuration

```text
~/.taya/
  config.yaml
  assistant/
    SYSTEM.md
    personality.yaml
    engineering.yaml
    workdirs.yaml
  agents/
    executor/
      profile.yaml
      SYSTEM.md
    reviewer/
      profile.yaml
      SYSTEM.md
    architect/       # coding-standard.yaml only
      profile.yaml
      SYSTEM.md
    coder/            # coding-standard.yaml only
      profile.yaml
      SYSTEM.md
    qa/               # coding-standard.yaml only
      profile.yaml
      SYSTEM.md
  workflows/
    coding-small.yaml     # default
    coding-standard.yaml  # opt-in
```

No secrets are stored under `~/.taya`. Pi resolves credentials through its normal auth store.

## Prompt composition

Taya launches the real `pi` executable and replaces its base system prompt. Pi continues to append repository context files and available Skills.

The primary assistant receives:

```text
Taya core contract
+ assistant/SYSTEM.md
+ personality.yaml
+ engineering.yaml
+ Herdr and Workboard coordination rules
```

A professional Agent receives:

```text
Taya communication contract
+ engineering.yaml
+ role SYSTEM.md
+ role profile constraints
+ current workflow-stage contract
```

The task itself is sent as the first user message, not embedded into the role identity. Professional Agents inherit engineering preferences but not the assistant's personality.

The MVP uses prompt-level role restrictions. It does not claim hard filesystem or command isolation.

## Communication

Herdr CLI and its existing socket are the only transport. There is no Taya Bridge Extension and no additional socket.

Taya messages use JSON metadata plus a readable Markdown body:

```text
[TAYA-MSG] {"v":1,"id":"msg_42","from":"architect","to":"assistant","type":"review.changes_requested","replyTo":"msg_37"}

Two blocking findings. See `.taya/review.md`.

[/TAYA-MSG]
```

Required metadata:

- `v`: protocol version, currently `1`
- `id`: unique delivery ID used for acknowledgement and deduplication
- `from` and `to`: role pane names
- `type`: workflow semantic
- `replyTo`: command/result correlation or `null`

The workspace supplies task isolation, so messages do not repeat workspace or task IDs.

Only the primary assistant routes business messages. Professional Agents communicate with the assistant, not directly with one another. Supervisor messages also target the assistant.

Command-like messages require acknowledgement. If no acknowledgement arrives, the assistant retries once. A second timeout becomes an agent-lost event. Progress notifications do not require acknowledgement.

Initial message types:

```text
task.assigned
message.acknowledged
plan.ready
implementation.ready
review.approved
review.changes_requested
qa.passed
qa.failed
mr.created
ci.passed
ci.failed
decision.requested
decision.resolved
agent.blocked
agent.progress
task.cancelled
task.completed
```

## Workboard contract

herdr-workboard is separately owned and may be changed directly. Its responsibilities are deliberately decoupled from Taya and Pi.

Taya calls a workspace-scoped CLI; it never edits board JSON directly. The commands Taya depends on:

```bash
herdr-workboard task add <title> [--body <t>] [--state <id|name>] --workspace <id> --json
herdr-workboard task list [--state <s>] [--all] --json
herdr-workboard task move <t> --state <s> --json
herdr-workboard task archive <t> [--close-pane] --json
herdr-workboard workflow init <file> [--task <id>] --json
herdr-workboard workflow show --json
herdr-workboard status --json
herdr-workboard transition architecture_review --request-id msg_42 --json
herdr-workboard run start architect --json
herdr-workboard run finish architect --result passed --json
```

Taya owns workspace creation (see Runtime topology), so the task-creation call happens before any pane exists inside that workspace and addresses it explicitly with `--workspace <id>` (or `--board <id>`, when the board id is already known) rather than relying on the invoking pane's own context. `workflow init --task <id>` binds a card to the workflow: each transition then moves that card into the stage's column and reports it as a `card` object on the response.

Required CLI behavior:

- JSON output
- stable error codes
- non-zero exit status on rejected transitions
- idempotent request IDs
- automatic resolution of the current Herdr workspace

At task creation, Taya creates a fresh Herdr workspace with `assistant` as tab 1, then invokes `herdr plugin action invoke phoobobo.workboard.attach` to append Workboard and its state tabs without replacing or reordering existing tabs. It then passes the selected declarative workflow to Workboard. Workboard stores a task-level snapshot so later template edits cannot mutate active work.

Taya depends only on Workboard's public actions and workspace-scoped CLI contract.

The default workflow file is `coding-small.yaml` (implement, independent review, submit, ci, merged). `coding-standard.yaml` (architect/coder/qa/mr_review) is retained as the opt-in heavier template. Both bind the same way today, through `workflow init --task`; no CLI-contract change is needed to support the new default.

## Taya Pick (Phase 1 / MVP)

Taya Pick, run by Taya Server, is the producer half of the routine loop (see the product spec for the full staged roadmap). This section covers only the Phase 1 / MVP mechanics; Phase 2 and long-term stay at the product-spec narrative level, since they're explicitly future work.

- A single configured source adapter for MVP: GitHub Issues via `gh issue list --json`.
- To-Do capacity: a simple count check against Workboard's To-Do state, via the existing `herdr-workboard task list --state <todo> --all --json`, before picking a new item.
- Newly picked items become Workboard cards via the existing `herdr-workboard task add ... --json` (`WorkboardClient.createTask` in `src/workboard/client.ts`) — no new Workboard CLI surface is needed for Phase 1.
- Running-capacity admission — actually starting a task workspace for a To-Do card once capacity allows — is explicitly **not specified in this pass**; see the open question in [Taya Server vs. Taya Agent session](#taya-server-vs-taya-agent-session).

## Worktree and transient artifacts

A Work Directory is a local working context, not a remote-repository binding. For a Git repository with a usable remote, Taya fetches the remote default branch and creates a clean worktree. For a Git repository without a remote, it uses the local default branch; for a non-Git directory, it creates an isolated directory copy. Existing uncommitted changes in the user's original checkout are not copied into an isolated task environment.

All roles share the task worktree or copied directory. The executor writes source; the reviewer inspects it (or, under the heavier opt-in workflow, the coder writes source while the architect and QA inspect it). Transient collaboration files are excluded from delivery:

```text
.taya/
  architecture.md
  review.md
  qa.md
```

Review and QA append timestamped rounds rather than overwriting earlier results. The directory is deleted with the worktree only after merge or explicit cancellation.

## Preference document

A durable, per-Work-Directory `policy.md` lives outside any single task's worktree — unlike `.taya/architecture.md`, `review.md`, and `qa.md`, it is not deleted when a worktree goes away, since it needs to persist across many tasks and across Taya Pick cycles. It is distinct from `~/.taya/assistant/engineering.yaml`, which stays global and cross-repo.

Whenever the user corrects a routine decision, that correction is appended to the relevant Work Directory's `policy.md`. The executor and reviewer read it before acting on that Work Directory.

## Provider adapters

Work Directory registration does not require Git, a remote, or a Provider. An optional Provider value is only a delivery override. When a task needs remote delivery, Taya inspects the repository's `origin` and resolves:

- `github`: `gh`
- `bits-codebase`: `bitscli codebase`

Provider adapters expose repository discovery, branch push, MR creation/update, review state, CI state, and merge. Local-only tasks do not require an adapter. Missing delivery tools trigger guided setup rather than credential storage in Taya.

## Supervisor

`taya supervise` is a deterministic polling/wait loop in its own pane. It asks Herdr for agent state and provider adapters for MR/CI state. It updates mechanical run facts through Workboard and sends structured facts to the assistant through Herdr.

It must not select workflows, change plans, issue technical instructions, or merge.

Whether Supervisor remains a distinct process from Taya Server, or becomes one of its internal functions alongside Taya Pick, is the open question noted in [Taya Server vs. Taya Agent session](#taya-server-vs-taya-agent-session).

## Recovery

Herdr session `taya` is the recovery boundary. `herdr --session taya` restores workspaces and panes. Taya re-resolves pane names and reconciles Workboard with live Herdr, Git, MR, and CI facts. Taya does not persist pane IDs or duplicate a `~/.taya/sessions` hierarchy.

## Installation

Taya is an ESM npm package requiring macOS and Node.js 22.19 or newer. It discovers:

- `pi`
- `herdr`
- Herdr plugin `phoobobo.workboard`
- `gh` and/or `bitscli`

Missing Pi, Herdr, or Workboard is installed or guided during onboarding. Model login remains a Pi operation.
