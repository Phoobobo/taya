---
name: taya-delegation
description: Spawn a professional agent into its own Herdr pane and drive it through a workflow stage. Use when the current stage belongs to a role other than assistant.
---

# Delegation

You coordinate; the professional agents execute. You do not write product code yourself — you put the right role in front of the work and drive the board.

## Who runs the current stage

Ask Workboard, don't guess:

```bash
herdr-workboard workflow show --json
```

The stage whose name matches `current_stage` names its `agent`. If that agent is `assistant`, the stage is yours — do it yourself. Otherwise delegate to that role.

## Spawning a role

One pane per role, named for the role, in the task's workspace. Reuse the pane if it already exists — a role gets one session per task, not one per stage.

```bash
herdr pane list                                    # is there already a pane for this role?
herdr tab create --workspace <id> --label <role> --cwd <worktree> --no-focus
herdr pane rename <pane_id> <role>
herdr pane run <pane_id> "taya agent --role <role> --workdir <worktree>"
```

`taya agent` composes that role's prompt — the shared contract, engineering preferences, its own SYSTEM.md, its constraints, and the current stage's contract — and launches it as a native session. You do not assemble prompts yourself.

Give the agent a moment to start before messaging it; a pane that exists is not yet a session that is listening.

## Handing over the task

Send one `task.assigned` message with everything the agent needs and nothing it doesn't:

- what to do, in one or two sentences
- the worktree path
- the artifact its stage owns, if any (`.taya/review.md`, `.taya/qa.md`)
- anything a previous stage produced that bears on this one

Detail belongs in the artifact, not the message. Then record the run:

```bash
herdr-workboard run start <role> --json
```

## While a stage is running

Wait on the agent's own report. Do not poll its pane for progress — a session that is thinking looks identical to one that is stuck, and reading its screen tells you nothing its message wouldn't.

Act when the report arrives:

| Report | What you do |
|---|---|
| stage succeeded | `run finish <role> --result passed`, then `transition <next-stage> --request-id <msg-id>` |
| stage failed | `run finish <role> --result failed`, then transition to the stage's `retry_to` |
| `agent.blocked` | Read what it is blocked on. Resolve it if it is ordinary; escalate to the user only under the interruption policy. |
| nothing, for a long time | Check the pane's agent status through Herdr before assuming failure. |

Every transition needs the `--request-id` of the message that caused it, so a retry replays instead of double-applying.

## Ending a task

The task is done when its MR is merged, not when the last agent reports success. Drive it through `ci` and `merged` yourself — those stages are yours.

Leave the role panes alive until the user closes the workspace. They are the record of what happened, and the user may want to read or take one over.
