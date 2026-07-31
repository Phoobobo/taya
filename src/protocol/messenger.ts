import type { HerdrClient } from "../herdr/client.js";
import { createMessage, encodeMessage, type TayaMessage } from "./message.js";

export interface SendMessageInput {
  from: string;
  to: string;
  type: string;
  replyTo?: string | null;
  body: string;
  id?: string;
  /**
   * Workspace holding the recipient pane. Background processes should set this
   * rather than relying on their own pane's workspace to resolve the target.
   */
  workspaceId?: string;
}

export class TayaMessenger {
  constructor(private readonly herdr: HerdrClient) {}

  async send(input: SendMessageInput): Promise<TayaMessage> {
    const message = createMessage({
      id: input.id,
      from: input.from,
      to: input.to,
      type: input.type,
      replyTo: input.replyTo ?? null,
    }, input.body);
    await this.herdr.send(input.to, encodeMessage(message), input.workspaceId);
    return message;
  }

  async acknowledge(message: TayaMessage, from: string, body = "Accepted."): Promise<TayaMessage> {
    return this.send({
      from,
      to: message.header.from,
      type: "message.acknowledged",
      replyTo: message.header.id,
      body,
    });
  }
}
