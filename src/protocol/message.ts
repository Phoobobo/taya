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

export function encodeMessage(message: TayaMessage): string {
  return `[TAYA-MSG] ${JSON.stringify(message.header)}\n\n${message.body}\n\n[/TAYA-MSG]`;
}

export function decodeMessage(input: string): TayaMessage {
  const match = input.trim().match(/^\[TAYA-MSG\]\s+(\{[^\n]+\})\n\n([\s\S]*?)\n\n\[\/TAYA-MSG\]$/);
  if (!match) throw new Error("Invalid TAYA-MSG envelope");

  let header: unknown;
  try {
    header = JSON.parse(match[1]);
  } catch {
    throw new Error("Invalid TAYA-MSG JSON header");
  }
  if (!isHeader(header)) throw new Error("Invalid TAYA-MSG header fields");
  return { header, body: match[2].trim() };
}

function isHeader(value: unknown): value is TayaMessageHeader {
  if (!value || typeof value !== "object") return false;
  const header = value as Partial<TayaMessageHeader>;
  return header.v === TAYA_MESSAGE_VERSION
    && nonEmpty(header.id)
    && nonEmpty(header.from)
    && nonEmpty(header.to)
    && nonEmpty(header.type)
    && (header.replyTo === null || nonEmpty(header.replyTo));
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
