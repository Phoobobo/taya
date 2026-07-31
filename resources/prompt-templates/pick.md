---
description: Check the configured Pick source and admit new routine work into the Workboard To-Do list
---

Check your Pick source for new routine work and admit what fits into the Workboard To-Do list.

## Source

By default the source is GitHub Issues on the current repository:

```bash
gh issue list --json number,title,url,state
```

This is the one part of Pick you are meant to change. Edit this file to point at whatever holds your work — a different CLI, an internal tracker, or a plain Markdown checklist in the repository. Describe the source here and the steps below still apply.

## Capacity

Keep at most **5** cards in the To-Do column. Count what is already there first:

```bash
herdr-workboard task list --state todo --json
```

If the column is already at or over that limit, stop. Do not admit anything.

## Steps

1. Read the current board so you know what already exists:
   ```bash
   herdr-workboard task list --all --json
   ```
2. Read the source (see above).
3. Skip anything already on the board. Each card Pick creates records where it came from in its body as `Source: <url>`, so match on that rather than on the title — titles get edited.
4. Judge what is left. Admit only work that is genuinely routine: a task of a kind you have done before, whose shape you recognise, and which you could carry to a merged result without needing the user to decide something first. Leave anything ambiguous, novel, or open-ended on the source. Not picking is a valid outcome.
5. For each item you admit, up to the remaining capacity, oldest first:
   ```bash
   herdr-workboard task add "<title>" --body "Source: <url>" --state todo
   ```
6. Report what you admitted and what you deliberately skipped, with a one-line reason for each skip.

## If the source is not reachable

If the source command fails or you have no source configured, say so plainly and stop. Do not substitute a different source, and do not invent work.
