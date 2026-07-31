# Taya Product Specification

## Product

Taya is the product name for **True Assistant**. It retains the original `TA` initials while reading like a personal name. It is a real assistant for software engineers.

Taya's job is to let the user stop watching it work — but only for work with a stable, repeated shape. Genuinely new, undecided requirements stay out of scope for autonomous decision-making: an assistant can only decide on the user's behalf where the user's own preferences are already stable, and preferences only become stable through repetition. Novel work still routes through a live conversation with the user.

Taya is two processes:

- **Taya Server** — a persistent, non-LLM service process. It owns Workboard admission and mechanical task-lifecycle plumbing. It never makes a product or technical decision.
- **Taya Agent primary session** — the LLM-backed assistant the user actually talks to.

Work enters Taya one of two ways:

- **Ad-hoc.** The user gives an engineering goal directly to the primary assistant. The assistant researches the repository, selects a workflow, delegates work to visible coding-harness sessions, monitors progress, resolves ordinary blockers, and drives the change through review, CI, and merge. The user can inspect or take over any session at any time.
- **Routine.** Taya Pick, running under Taya Server, continuously discovers and admits routine work with no action from the user — see [Taya Pick](#taya-pick).

## Product principles

1. **One assistant.** A Taya installation has one primary assistant identity and multiple professional Agent Profiles.
2. **User-owned configuration.** Human-readable configuration lives under `~/.taya`. Credentials remain owned by the coding harness.
3. **Native harness sessions.** Every assistant and worker is a real coding-harness TUI session — Pi today, with the design leaving room for others (Claude Code, Codex, Grok) — not an imitation embedded in another UI.
4. **Active user, quiet team.** The user checks progress when desired. The team interrupts only for major decisions the assistant cannot resolve on its own.
5. **Observable delegation.** Herdr exposes every working session live, in its own pane; Workboard exposes workflow state as a kanban board with per-state task counts and click-through from a card straight to its session. This live, controllable fleet view — not team simulation — is what Taya adds beyond a background-scheduled agent.
6. **Merge is completion.** A coding task is complete only after its MR is merged or the user explicitly cancels it.
7. **Server owns plumbing, agent owns judgment.** Mechanical concerns — capacity, admission, task lifecycle, board state — belong to Taya Server and never require an LLM. Product and technical judgment belongs to the agent session.
8. **Bounded autonomy.** The assistant decides on its own only where an explicit, accumulated preference exists for that class of work. Where none exists and the stakes are non-trivial, it asks rather than guesses.
9. **Accumulated preference.** Every user correction is captured into a durable, growing policy artifact (see [Preference document](#preference-document)) so the same question isn't asked twice.

## Taya Pick

Taya Pick is the producer half of a classic producer/consumer model: it finds work and admits it into the Workboard To-Do list, bounded by capacity.

- **Source configuration.** Which external source(s) to pick from — e.g. GitHub Issues.
- **To-Do capacity.** The maximum number of pending cards Pick will let sit in the To-Do list at once.
- **Running capacity.** The maximum number of cards in flight at once — including temporarily suspended or blocked cards, i.e. anything not yet in a terminal state.

Picked items land in the Workboard To-Do list. What consumes the To-Do list — i.e. when and how a card actually gets pulled into execution within Running capacity — is an **open question**, intentionally not decided in this pass. It is Taya Server's responsibility, but whether that responsibility is Taya Pick's own or a separate internal component is left for a later design pass.

### Staged roadmap

- **Phase 1 (MVP).** Mechanical. A single fixed source. Pick admits items into Workboard respecting the To-Do capacity limit, with no judgment about which items are worth picking.
- **Phase 2.** Session-based, multi-source discovery. Pick evaluates confidence and routine-ness before picking, so it only admits work it's actually equipped to finish.
- **Long-term.** Pick becomes the daily-driver center of gravity:
  - Full unattended handling, start to delivery, of task types Taya has done many times.
  - **Taya Challenge** — Pick deliberately attempts unfamiliar task types. Repeated successful challenges graduate a task type into the routine/confident set. This is the system's self-evolution loop.

## MVP scope

The MVP supports macOS, Node.js 22.19+, npm, GitHub via `gh`, and ByteDance Codebase via `bitscli codebase`.

It includes:

- `taya init` and first-run onboarding
- one primary assistant and configurable Agent Profiles
- recent Work Directory selection
- one persistent Herdr session named `taya`
- one Herdr workspace per engineering task, ad-hoc or routine
- native harness panes for the primary assistant, executor, and reviewer
- a non-LLM Taya Server process running Taya Pick (Phase 1: single fixed GitHub Issues source, mechanical To-Do admission)
- herdr-workboard state storage, CLI transitions, and UI
- the lightweight default workflow (`coding-small.yaml`): implement, independent review, submit, CI, merge
- the heavier opt-in workflow (`coding-standard.yaml`): architect/coder/qa/mr_review, unchanged from today, available for tasks that want more structure
- one worktree and one MR per task
- a per-Work-Directory policy document that accumulates user corrections
- user takeover and hand-back
- local Work Directories with optional GitHub and Codebase delivery detection

Deferred:

- Taya Pick Phase 2 and long-term (multi-source discovery, confidence evaluation, Taya Challenge)
- coding harnesses other than Pi
- the internal decomposition of Taya Server beyond "it runs Taya Pick and admits work"
- stacked MRs
- multi-repository tasks
- Botmux notifications
- automated profile evolution and daily review UI
- hard role sandboxes

## Roles

### Taya Server

A persistent, non-LLM service process. Runs Taya Pick and owns task-lifecycle plumbing — admitting To-Do cards into execution within Running capacity. Makes no product or technical decisions. Its internal decomposition is left open; see [Taya Pick](#taya-pick).

### Taya Pick

The discovery/admission function within Taya Server. See [Taya Pick](#taya-pick) above.

### Primary assistant (Taya Agent session)

For ad-hoc tasks: the only decision-making coordinator, unchanged from today. It is prompt-constrained not to modify code. It may inspect repositories, select workflows, create workspaces and worktrees, route messages, update Workboard through its CLI, monitor MRs and CI, and merge when checks pass.

For routine tasks admitted by Taya Server: a lightweight continuous monitor over protocol messages and an escalation receiver — not the operational driver of every mechanical step.

### Executor

The default single agent for a task. Plans and implements end to end. Replaces Coder as the default; the only role expected to modify source, create commits, push branches, and create or update the MR. It does not merge.

### Reviewer

An independent agent, given a fresh context, spawned only to verify the executor's diff before submit. A hard gate, not optional — distinct from the executor so it isn't grading its own work.

### Architect / Coder / QA

Unchanged from today, available under the heavier opt-in `coding-standard.yaml` workflow for tasks that want more structure than the default Executor/Reviewer pair. Architect writes `.taya/architecture.md`, reviews the coder's uncommitted implementation, appends review rounds to `.taya/review.md`, and reviews the final MR diff without modifying product source. Coder is the only role expected to modify source, create commits, push branches, and create or update the MR, and does not merge. QA runs tests and appends test rounds to `.taya/qa.md` without intentionally editing source or committing.

### Supervisor

A deterministic process, not an Agent. It observes Herdr agent state, timeouts, pane loss, MR state, and CI state. It reports facts to the primary assistant but makes no business or technical decisions. Its relationship to Taya Server and Taya Pick is part of the open question above.

## Standard coding workflow

Default (`coding-small.yaml`):

1. `implementing`: Executor implements without committing.
2. `review`: Reviewer verifies the diff in a fresh context.
3. `submit`: Executor commits, pushes, and opens an MR.
4. `ci`: Primary assistant (or Taya Server, for a routine task) monitors checks.
5. `merged`: Primary assistant merges and deletes the worktree.

Opt-in (`coding-standard.yaml`), unchanged from today:

1. `planning`: Architect writes `.taya/architecture.md`.
2. `implementing`: Coder implements without committing.
3. `architecture_review`: Architect appends to `.taya/review.md`.
4. `qa`: QA appends to `.taya/qa.md`.
5. `submit`: Coder commits, pushes, and opens an MR.
6. `mr_review`: Architect reviews the final MR diff.
7. `ci`: Primary assistant monitors checks.
8. `merged`: Primary assistant merges and deletes the worktree.

In either workflow, review failures return to implementation. The role that raised an issue verifies its fix; the primary assistant decides whether wider regression is needed.

## User interruption policy

The primary assistant asks the user only when it cannot resolve uncertainty involving:

- changed responsibility boundaries across services or repositories
- rejection of a user-confirmed technical direction
- substantial long-term cost, security risk, or operational complexity
- a non-trivial decision with no matching entry in the Work Directory's policy document — absence of a matching preference is itself a reason to ask, not a reason to guess

Ordinary implementation choices, task ordering, review feedback, retries, commits, MR creation, and merge are autonomous once a matching preference exists.

## Preference document

A durable, per-Work-Directory `policy.md` — distinct from the ephemeral `.taya/*.md` worktree files, which are deleted with the worktree. The policy document persists across tasks and across Taya Pick cycles.

Whenever the user corrects a routine decision, that correction is appended to the relevant Work Directory's policy document. The executor and reviewer read it before acting on that Work Directory, so the same question doesn't need to be asked twice.

## Takeover

The user runs `/takeover` in a worker session to assume control. The primary assistant continues tracking the task but does not overwrite user instructions. Disagreements are discussed with the user. `/handoff-back` returns execution control.

## Definition of Done

A release candidate passes two real macOS scenarios.

Ad-hoc:

1. `taya` restores or creates Herdr session `taya`.
2. The user confirms a Work Directory.
3. Taya creates a task workspace with Assistant as the first tab, followed by Workboard, Supervisor, Executor, and Reviewer panes.
4. The assistant executes the default workflow through native harness sessions.
5. The reviewer inspects the executor's shared worktree in a fresh context.
6. The executor creates the MR only after the reviewer passes it.
7. CI passes and the assistant merges without another prompt.
8. Taya deletes the worktree and marks the Workboard task merged.
9. All panes remain available until the user confirms exit.

Routine:

1. Taya Pick admits an issue into the Workboard To-Do list from its configured source.
2. Taya Server starts it within Running capacity.
3. The executor fixes it; the independent reviewer approves it.
4. CI passes and the task merges with no prompt to the user.
5. Any user correction along the way is appended to that Work Directory's policy document.
