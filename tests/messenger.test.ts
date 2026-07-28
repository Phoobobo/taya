import { describe, expect, it, vi } from "vitest";
import type { HerdrClient } from "../src/herdr/client.js";
import { decodeMessage } from "../src/protocol/message.js";
import { TayaMessenger } from "../src/protocol/messenger.js";

describe("TayaMessenger", () => {
  it("sends a valid envelope to the named role pane", async () => {
    const send = vi.fn(async () => undefined);
    const messenger = new TayaMessenger({ send } as unknown as HerdrClient);

    const message = await messenger.send({
      id: "msg-1",
      from: "assistant",
      to: "coder",
      type: "task.assigned",
      body: "Implement the approved plan.",
    });

    expect(message.header.id).toBe("msg-1");
    expect(send).toHaveBeenCalledOnce();
    const [pane, envelope] = send.mock.calls[0];
    expect(pane).toBe("coder");
    expect(decodeMessage(envelope).header).toEqual(message.header);
  });
});
