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

  it("rejects unsupported versions", () => {
    const input = `[TAYA-MSG] {"v":2,"id":"x","from":"qa","to":"assistant","type":"qa.passed","replyTo":null}\n\nok\n\n[/TAYA-MSG]`;
    expect(() => decodeMessage(input)).toThrow("Invalid TAYA-MSG header fields");
  });
});
