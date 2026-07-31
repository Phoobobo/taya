import { describe, expect, it } from "vitest";
import { createMessage, decodeMessage, encodeMessage } from "../src/protocol/message.js";

describe("TAYA-MSG", () => {
  it("round trips JSON metadata and Markdown body", () => {
    const message = createMessage({
      id: "msg-1",
      from: "architect",
      to: "assistant",
      type: "plan.ready",
      replyTo: "msg-0",
    }, "Plan written to `.taya/architecture.md`.");

    expect(decodeMessage(encodeMessage(message))).toEqual(message);
  });

  it("generates an id when the caller passes an explicit undefined", () => {
    const message = createMessage({
      id: undefined,
      from: "scheduler",
      to: "assistant",
      type: "pick.check",
      replyTo: null,
    }, "Check now.");

    expect(message.header.id).toMatch(/\S/);
    expect(encodeMessage(message)).toContain(`"id":"${message.header.id}"`);
  });

  it("encodes to a single line so delivery cannot submit early", () => {
    const message = createMessage({
      from: "architect",
      to: "assistant",
      type: "review.changes_requested",
      replyTo: null,
    }, "Two blocking findings.\n\n- unchecked index\n- missing rollback");

    const envelope = encodeMessage(message);

    expect(envelope).not.toContain("\n");
    expect(decodeMessage(envelope).body).toBe("Two blocking findings.\n\n- unchecked index\n- missing rollback");
  });

  it("rejects unsupported versions", () => {
    const input = `[TAYA-MSG] {"v":2,"id":"x","from":"qa","to":"assistant","type":"qa.passed","replyTo":null,"body":"ok"}`;
    expect(() => decodeMessage(input)).toThrow("Invalid TAYA-MSG header fields");
  });
});
