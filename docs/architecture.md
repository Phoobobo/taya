# Taya Architecture

## System boundary

Taya composes three independent systems through their public CLIs:

- **Pi** runs every LLM conversation and owns model authentication. Pi is the first of potentially several pluggable coding harnesses this design leaves room for (Claude Code, Codex, Grok); only Pi is implemented in the MVP, and no harness adapter interface is designed yet.
- **Herdr** owns the persistent terminal session, workspaces, panes, and agent visibility. It carries messages into TUI sessions, but is no longer the only channel — see [Communication](#communication).
- **herdr-workboard** owns task state, workflow transition validation, persistence, CLI access, and board UI.

Taya does not read Herdr or Workboard internal storage. It does not duplicate Pi session storage.

## Taya Server vs. Taya Agent session

Taya has two kinds of process:

- **Taya Server** — persistent, one per `taya` Herdr session (not per task workspace), non-LLM. It survives across many task workspaces coming and going, and owns Workboard admission (via Taya Pick) and mechanical task-lifecycle plumbing.
- **Taya Agent primary session** — an LLM harness session (Pi today), the same kind of process as any worker pane. It is scoped per task workspace for ad-hoc tasks, or runs as a lightweight, continuous monitor for server-admitted routine tasks.

Taya Server runs the Scheduler (a bare interval timer that nudges the assistant) and Taya Pick. How Running-capacity admission is implemented — what actually pulls a To-Do card into execution — remains an **open question**, intentionally not resolved yet.

## Runtime topology

There is one named Herdr session per Taya installation:

```text
herdr --session taya
```

Each engineering task gets one Herdr workspace, whether started ad-hoc by the user or admitted by Taya Pick — only the initiator differs (the user via `taya start`, or Taya Server for a routine task). Taya creates the workspace itself so `assistant` is always the first tab, then attaches Workboard without reordering existing tabs. Panes have stable role names within that workspace:

```text
assistant  # first tab
workboard
executor
reviewer
```

The heavier opt-in workflow (`coding-standard.yaml`) uses `architect`, `coder`, and `qa` panes instead of `executor`/`reviewer`.

A read-only `advisor` pane may appear transiently while an executor is consulting an [Advisor](#advisor), and disappears when that executor session ends.

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

Taya uses three channels, chosen by what the channel has to carry:

- **Herdr** opens panes, spawns sessions, and delivers messages *into* TUI sessions via `pane send-text` followed by `pane send-keys ... Enter`. It remains the visibility and takeover layer: anything the user should be able to watch or take over lives in a Herdr pane.
- **Pi RPC** (`pi --mode rpc`, JSONL over stdin/stdout) carries structured control where a text nudge is not enough — the Advisor's `fork`, `get_tree`, and structured `prompt` responses. It is **not** HTTP; pi has no HTTP, server, daemon, or attach mode.
- **Session JSONL files** under `~/.pi/agent/sessions/` are read directly for state extraction. This is read-only and involves no transport at all.

A single `pi` process is **either** a TUI pane **or** an RPC endpoint, never both: RPC mode is headless and owns the process's stdin/stdout. There is no way to attach an RPC client to a running TUI session. This is why the [Advisor](#advisor) runs headless and is mirrored into a read-only pane rather than being an ordinary interactive pane.

If a TUI session ever needs a real control channel, the next rung of the capability escalation ladder is a pi extension, which can open its own channel from inside the session.

Messages sent through Herdr use JSON metadata plus a readable Markdown body:

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

Only the primary assistant routes business messages. Professional Agents communicate with the assistant, not directly with one another. Scheduler nudges also target the assistant.

Command-like messages require acknowledgement. If no acknowledgement arrives, the assistant retries once. A second timeout becomes an agent-lost event. Progress notifications do not require acknowledgement.

Initial message types:

```text
task.assigned
message.acknowledged
pick.check
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

The default workflow file is `coding-small.yaml`; `coding-standard.yaml` (architect/coder/qa/mr_review) is retained as the opt-in heavier template. Both bind the same way today, through `workflow init --task`; no CLI-contract change is needed to support the new default.

`resources/workflows/coding-small.yaml` still names its stages `coder` and `qa`. Renaming them to `executor` and `reviewer`, to match the roles this document describes, is pending work.

## Taya Pick (Phase 1 / MVP)

Taya Pick, run by Taya Server, is the producer half of the routine loop (see the product spec for the full staged roadmap). This section covers only the Phase 1 / MVP mechanics; Phase 2 and long-term stay at the product-spec narrative level, since they're explicitly future work.

- A single configured source adapter for MVP: GitHub Issues via `gh issue list --json`.
- To-Do capacity: a simple count check against Workboard's To-Do state, via the existing `herdr-workboard task list --state <todo> --all --json`, before picking a new item.
- Newly picked items become Workboard cards via the existing `herdr-workboard task add ... --json` (`WorkboardClient.createTask` in `src/workboard/client.ts`) — no new Workboard CLI surface is needed for Phase 1.
- The [Scheduler](#scheduler) is what makes this periodic: it fires a `pick.check` nudge at the assistant on an interval, and the assistant does the actual source check.
- Running-capacity admission — actually starting a task workspace for a To-Do card once capacity allows — is explicitly **not specified yet**; see the open question in [Taya Server vs. Taya Agent session](#taya-server-vs-taya-agent-session).

## Scheduler

The Scheduler is a deterministic interval loop inside Taya Server. On each tick it sends a nudge to the assistant pane through Herdr — for example `pick.check` — and does nothing else. It carries no state about the work, inspects nothing, and makes no decision.

It must not select workflows, change plans, issue technical instructions, or merge.

The Scheduler replaces the former Supervisor, which polled Herdr for agent state and provider adapters for MR/CI state and reported those facts to the assistant. That watching responsibility now sits with each executor session, and reporting is reconstructed on demand from durable artifacts (see [Session state extraction](#session-state-extraction)).

`src/supervisor.ts` still implements the old polling design. Migrating it to the Scheduler shape is pending work, not something this document describes as done.

## Advisor

An Advisor is forked on demand when an executor session cannot resolve a decision alone.

- It runs as `pi --mode rpc`, spawned by Taya, communicating over stdio JSONL. RPC is what makes the rest of this section possible; a TUI session could not offer it.
- Its context slice is chosen at fork time: `get_fork_messages` lists the user messages available as fork points, and `fork {entryId}` derives the Advisor from the chosen one. This is how an Advisor stays lightweight — it inherits only the part of the executor's history that the decision actually needs.
- Its session JSONL is tailed into a read-only Herdr pane so the user can watch the consultation. That pane is not interactive: the real process reads stdin from Taya, so typing into the pane does nothing.
- It is destroyed when its executor session ends, not when it answers the first question — follow-up questions on the same decision are expected.

## Session state extraction

Reconstructing what a session is doing costs no tokens, because it reads structure rather than asking a model to summarize:

- `get_entries` returns entries in append order and accepts a `since` cursor. Entry ids are durable across client restarts, which makes them usable as a polling cursor.
- `get_tree` returns the full tree, including each entry's `label` and `labelTimestamp`.
- Entry **labels** are how decisions stay recoverable. Executor sessions label decisions as they make them; nothing has to re-derive them afterwards.
- The `/tree` filter modes — `user-only`, `labeled-only`, `no-tools` — are the precedent for which entries are worth extracting.
- Sessions are plain JSONL under `~/.pi/agent/sessions/`, so Taya can read them off disk directly, whether the session is TUI or RPC.

Pi's `/compact` and its branch summarization are **not** part of this mechanism. Both call an LLM to generate their summaries and report token `usage` and `cost` accordingly. They manage a session's own context; they are not a free reporting channel.

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

## Recovery

Herdr session `taya` is the recovery boundary. `herdr --session taya` restores workspaces and panes. Taya re-resolves pane names and reconciles Workboard with live Herdr, Git, MR, and CI facts. Taya does not persist pane IDs or duplicate a `~/.taya/sessions` hierarchy.

## Installation

Taya is an ESM npm package requiring macOS and Node.js 22.19 or newer. It discovers:

- `pi`
- `herdr`
- Herdr plugin `phoobobo.workboard`
- `gh` and/or `bitscli`

Missing Pi, Herdr, or Workboard is installed or guided during onboarding. Model login remains a Pi operation.
