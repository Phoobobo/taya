---
name: taya-herdr-communication
description: Send and receive structured TAYA-MSG messages between named Pi panes through Herdr.
---

# Taya Herdr communication

Use Herdr as the only transport. Communicate with the `assistant` pane, not directly with another professional agent.

A message is a single line — one `[TAYA-MSG]` marker followed by one JSON object:

```text
[TAYA-MSG] {"v":1,"id":"<unique-id>","from":"<your-role>","to":"assistant","type":"<type>","replyTo":"<message-id-or-null>","body":"<concise Markdown, including artifact paths>"}
```

**Never put a literal newline in the envelope.** Delivery is `send-text` followed by one Enter, so a newline submits early and splits your message into fragments that nobody can parse. Multi-line bodies are fine — write them as `\n` escapes inside the JSON string, which is what `JSON.stringify` produces for you.

For command messages, immediately return `message.acknowledged` with `replyTo` set to the command ID. Progress-only messages do not require acknowledgement.

Before sending, query Herdr for the current workspace's pane named `assistant`; do not cache pane IDs. Use `herdr pane send-text` followed by `herdr pane send-keys ... Enter`.

Long details belong in `.taya/architecture.md`, `.taya/review.md`, or `.taya/qa.md`. Messages should contain a summary and path.
