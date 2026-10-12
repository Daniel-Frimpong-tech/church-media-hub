/**
 * Reading what Telegram sends to the webhook. Telegram's payloads are large;
 * this picks out the few fields the bot uses and ignores everything else.
 */

export type IncomingCommand = {
  /** Lowercase, without the slash or @botname: "join", "linkgroup". */
  command: string;
  chatId: number;
  chatType: "private" | "group" | "supergroup" | "channel";
  chatTitle: string | null;
  messageId: number;
  fromId: number;
  fromName: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Returns the command in an update, or null if it is not a command from a
 * person (ordinary chat messages, edits, other bots, anything malformed).
 */
export function parseCommand(update: unknown): IncomingCommand | null {
  if (!isRecord(update) || !isRecord(update.message)) return null;
  const { message } = update;
  const { chat, from, text } = message;
  if (!isRecord(chat) || !isRecord(from) || typeof text !== "string") return null;
  if (from.is_bot === true) return null;
  if (typeof chat.id !== "number" || typeof from.id !== "number") return null;
  if (typeof message.message_id !== "number") return null;

  // "/join", "/join@rcw_media_bot", "/join extra words"
  const match = /^\/([a-z0-9_]{1,32})(?:@[A-Za-z0-9_]+)?(?:\s|$)/i.exec(text);
  if (!match) return null;

  const type = chat.type;
  if (type !== "private" && type !== "group" && type !== "supergroup" && type !== "channel") {
    return null;
  }

  const name = [from.first_name, from.last_name]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" ");

  return {
    command: match[1].toLowerCase(),
    chatId: chat.id,
    chatType: type,
    chatTitle: typeof chat.title === "string" ? chat.title : null,
    messageId: message.message_id,
    fromId: from.id,
    fromName: name || "Telegram user",
  };
}
