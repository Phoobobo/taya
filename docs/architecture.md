# Taya Architecture

## System boundary

Taya composes three independent systems through their public CLIs:

- **Pi** runs every LLM conversation and owns model authentication.
- **Herdr** owns the persistent terminal session, workspaces, panes, agent visibility, and inter-pane transport.
- **herdr-workboard** owns task state, workflow transition validation, persistence, CLI access, and board UI.

Taya does not read Herdr or Workboard internal storage. It does not duplicate Pi session storage.

## Runtime topology

There is one named Herdr session per Taya installation:

```text
herdr --session taya
```

Each engineering task gets one Herdr workspace. Taya creates the workspace itself so `assistant` is always the first tab, then attaches Workboard without reordering existing tabs. Panes have stable role names within that workspace:

```text
assistant  # first tab
workboard
supervisor
architect
coder
qa
```

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
    architect/
      profile.yaml
      SYSTEM.md
    coder/
      profile.yaml
      SYSTEM.md
    qa/
      profile.yaml
      SYSTEM.md
  workflows/
    coding-standard.yaml
    coding-small.yaml
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

Taya calls a workspace-scoped CLI; it never edits board JSON directly:

```bash
herdr-workboard status --json
herdr-workboard transition architecture_review --request-id msg_42 --json
herdr-workboard run start architect --json
herdr-workboard run finish architect --result passed --json
```

Required CLI behavior:

- JSON output
- stable error codes
- non-zero exit status on rejected transitions
- idempotent request IDs
- automatic resolution of the current Herdr workspace

At task creation, Taya creates a fresh Herdr workspace with `assistant` as tab 1, then invokes `herdr plugin action invoke phoobobo.workboard.attach` to append Workboard and its state tabs without replacing or reordering existing tabs. It then passes the selected declarative workflow to Workboard. Workboard stores a task-level snapshot so later template edits cannot mutate active work.

Taya depends only on Workboard's public actions and workspace-scoped CLI contract.

## Worktree and transient artifacts

A Work Directory is a local working context, not a remote-repository binding. For a Git repository with a usable remote, Taya fetches the remote default branch and creates a clean worktree. For a Git repository without a remote, it uses the local default branch; for a non-Git directory, it creates an isolated directory copy. Existing uncommitted changes in the user's original checkout are not copied into an isolated task environment.

All roles share the task worktree or copied directory. Coder writes source; Architect and QA inspect it. Transient collaboration files are excluded from delivery:

```text
.taya/
  architecture.md
  review.md
  qa.md
```

Review and QA append timestamped rounds rather than overwriting earlier results. The directory is deleted with the worktree only after merge or explicit cancellation.

## Provider adapters

Work Directory registration does not require Git, a remote, or a Provider. An optional Provider value is only a delivery override. When a task needs remote delivery, Taya inspects the repository's `origin` and resolves:

- `github`: `gh`
- `bits-codebase`: `bitscli codebase`

Provider adapters expose repository discovery, branch push, MR creation/update, review state, CI state, and merge. Local-only tasks do not require an adapter. Missing delivery tools trigger guided setup rather than credential storage in Taya.

## Supervisor

`taya supervise` is a deterministic polling/wait loop in its own pane. It asks Herdr for agent state and provider adapters for MR/CI state. It updates mechanical run facts through Workboard and sends structured facts to the assistant through Herdr.

It must not select workflows, change plans, issue technical instructions, or merge.

## Recovery

Herdr session `taya` is the recovery boundary. `herdr --session taya` restores workspaces and panes. Taya re-resolves pane names and reconciles Workboard with live Herdr, Git, MR, and CI facts. Taya does not persist pane IDs or duplicate a `~/.taya/sessions` hierarchy.

## Installation

Taya is an ESM npm package requiring macOS and Node.js 22.19 or newer. It discovers:

- `pi`
- `herdr`
- Herdr plugin `phoobobo.workboard`
- `gh` and/or `bitscli`

Missing Pi, Herdr, or Workboard is installed or guided during onboarding. Model login remains a Pi operation.
