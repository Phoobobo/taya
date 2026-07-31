import { randomUUID } from "node:crypto";

export const TAYA_MESSAGE_VERSION = 1 as const;

export interface TayaMessageHeader {
  v: typeof TAYA_MESSAGE_VERSION;
  id: string;
  from: string;
  to: string;
  type: string;
  replyTo: string | null;
}

export interface TayaMessage {
  header: TayaMessageHeader;
  body: string;
}

export function createMessage(
  input: Omit<TayaMessageHeader, "v" | "id"> & { id?: string },
  body: string,
): TayaMessage {
  // Spread first: callers routinely pass `id: undefined` to mean "generate one",
  // and a trailing spread would overwrite the generated id with that undefined.
  return {
    header: { ...input, v: TAYA_MESSAGE_VERSION, id: input.id ?? randomUUID() },
    body: body.trim(),
  };
}

/**
 * One line, always. Delivery is `herdr pane send-text` followed by a single
 * Enter, so any literal newline in the envelope would submit early and split
 * one message into several. The body therefore travels inside the JSON, where
 * standard escaping handles newlines, quotes, and the rest.
 */
export function encodeMessage(message: TayaMessage): string {
  return `[TAYA-MSG] ${JSON.stringify({ ...message.header, body: message.body })}`;
}

export function decodeMessage(input: string): TayaMessage {
  const match = input.trim().match(/^\[TAYA-MSG\]\s+(\{.*\})$/);
  if (!match) throw new Error("Invalid TAYA-MSG envelope");

  let payload: unknown;
  try {
    payload = JSON.parse(match[1]);
  } catch {
    throw new Error("Invalid TAYA-MSG JSON header");
  }
  if (!isPayload(payload)) throw new Error("Invalid TAYA-MSG header fields");
  const { body, ...header } = payload;
  return { header, body: body.trim() };
}

function isPayload(value: unknown): value is TayaMessageHeader & { body: string } {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<TayaMessageHeader & { body: string }>;
  return payload.v === TAYA_MESSAGE_VERSION
    && nonEmpty(payload.id)
    && nonEmpty(payload.from)
    && nonEmpty(payload.to)
    && nonEmpty(payload.type)
    && typeof payload.body === "string"
    && (payload.replyTo === null || nonEmpty(payload.replyTo));
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
