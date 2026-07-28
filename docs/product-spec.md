# Taya Product Specification

## Product

Taya is the product name for **True Assistant**. It retains the original `TA` initials while reading like a personal name. It is a real assistant for software engineers, built around Pi's minimal coding-agent experience.

The user gives an engineering goal to one primary assistant. The assistant researches the repository, selects a workflow, delegates work to visible Pi sessions, monitors progress, resolves ordinary blockers, and drives the change through review, QA, CI, and merge. The user can inspect or take over any Pi session in Herdr at any time.

## Product principles

1. **One assistant.** A Taya installation has one primary assistant identity and multiple professional Agent Profiles.
2. **User-owned configuration.** Human-readable configuration lives under `~/.taya`. Credentials remain owned by Pi.
3. **Native Pi sessions.** Every assistant and worker is a real Pi TUI, not an imitation embedded in another UI.
4. **Active user, quiet team.** The user checks progress when desired. The team interrupts only for major architecture decisions the assistant cannot resolve.
5. **Observable delegation.** Herdr exposes every working session; Workboard exposes workflow state.
6. **Merge is completion.** A coding task is complete only after its MR is merged or the user explicitly cancels it.

## MVP scope

The MVP supports macOS, Node.js 22.19+, npm, GitHub via `gh`, and ByteDance Codebase via `bitscli codebase`.

It includes:

- `taya init` and first-run onboarding
- one primary assistant and configurable Agent Profiles
- recent Work Directory selection
- one persistent Herdr session named `taya`
- one Herdr workspace per engineering task
- native Pi panes for assistant, architect, coder, and QA
- a non-LLM supervisor pane
- herdr-workboard state storage, CLI transitions, and UI
- one worktree and one MR per task
- architecture, implementation, review, QA, MR, CI, merge, and cleanup stages
- user takeover and hand-back
- local Work Directories with optional GitHub and Codebase delivery detection

Deferred:

- stacked MRs
- multi-repository tasks
- Botmux notifications
- automated profile evolution and daily review UI
- hard role sandboxes

## Roles

### Primary assistant

The only decision-making coordinator. It is prompt-constrained not to modify code. It may inspect repositories, select workflows, create workspaces and worktrees, route messages, update Workboard through its CLI, monitor MRs and CI, and merge when checks pass.

### Architect

Writes `.taya/architecture.md` inside the task worktree, reviews the coder's uncommitted implementation, appends review rounds to `.taya/review.md`, and reviews the final MR diff. It must not modify product source.

### Coder

The only role expected to modify source, create commits, push branches, and create or update the MR. It does not merge.

### QA

Runs tests and appends test rounds to `.taya/qa.md`. Tests may generate caches and build artifacts, but QA must not intentionally edit source or commit.

### Supervisor

A deterministic process, not an Agent. It observes Herdr agent state, timeouts, pane loss, MR state, and CI state. It reports facts to the primary assistant but makes no business or technical decisions.

## Standard coding workflow

1. `planning`: Architect writes `.taya/architecture.md`.
2. `implementing`: Coder implements without committing.
3. `architecture_review`: Architect appends to `.taya/review.md`.
4. `qa`: QA appends to `.taya/qa.md`.
5. `submit`: Coder commits, pushes, and opens an MR.
6. `mr_review`: Architect reviews the final MR diff.
7. `ci`: Primary assistant monitors checks.
8. `merged`: Primary assistant merges and deletes the worktree.

Review or QA failures return to implementation. The role that raised an issue verifies its fix; the primary assistant decides whether wider regression is needed.

## User interruption policy

The primary assistant asks the user only when it cannot resolve uncertainty involving:

- changed responsibility boundaries across services or repositories
- rejection of a user-confirmed technical direction
- substantial long-term cost, security risk, or operational complexity

Ordinary implementation choices, task ordering, review feedback, retries, commits, MR creation, and merge are autonomous.

## Takeover

The user runs `/takeover` in a worker Pi session to assume control. The primary assistant continues tracking the task but does not overwrite user instructions. Disagreements are discussed with the user. `/handoff-back` returns execution control.

## Definition of Done

A release candidate passes one real macOS scenario:

1. `taya` restores or creates Herdr session `taya`.
2. The user confirms a Work Directory.
3. Taya creates a task workspace with assistant, supervisor, Workboard, architect, coder, and QA panes.
4. The assistant executes the standard workflow through native Pi sessions.
5. Architect and QA inspect the coder's shared worktree.
6. Coder creates the MR only after local review and QA pass.
7. Architect approves the final MR diff.
8. CI passes and the assistant merges without another prompt.
9. Taya deletes the worktree and marks the Workboard task merged.
10. All panes remain available until the user confirms exit.
