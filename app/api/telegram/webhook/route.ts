import { timingSafeEqual } from "node:crypto";
import { type NextRequest } from "next/server";
import { appUrl, telegramWebhookSecret } from "@/lib/env";
import { sendMessage } from "@/lib/telegram/client";
import { createLinkToken, LINK_TOKEN_MINUTES } from "@/lib/telegram/link-tokens";
import {
  groupLinkMessage,
  HELP_MESSAGE,
  JOIN_IN_PRIVATE_MESSAGE,
  joinLinkMessage,
  LINKGROUP_IN_GROUP_MESSAGE,
} from "@/lib/telegram/messages";
import { parseCommand } from "@/lib/telegram/updates";

function secretMatches(received: string | null, expected: string): boolean {
  if (!received) return false;
  const a = Buffer.from(received);
  const b = Buffer.from(expected);
  // timingSafeEqual: comparison time does not reveal how much of it matched.
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Telegram calls this URL whenever someone messages the bot. Anyone on the
 * internet can call it too, so the first thing it does is check the secret
 * header that only Telegram was given when the webhook was registered.
 */
export async function POST(request: NextRequest) {
  const expected = telegramWebhookSecret();
  if (
    !expected ||
    !secretMatches(request.headers.get("x-telegram-bot-api-secret-token"), expected)
  ) {
    return new Response(null, { status: 401 });
  }

  let update: unknown;
  try {
    update = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }

  const command = parseCommand(update);
  if (command) {
    try {
      await handle(command);
    } catch (error) {
      console.error("Telegram command failed", error);
    }
  }
  // Always 200 once authenticated: any other status makes Telegram re-send
  // the same message again and again.
  return new Response(null, { status: 200 });
}

type Command = NonNullable<ReturnType<typeof parseCommand>>;

async function handle(command: Command): Promise<void> {
  const reply = (html: string) =>
    sendMessage(command.chatId, html, { replyToMessageId: command.messageId });
  const isPrivate = command.chatType === "private";
  const isGroup = command.chatType === "group" || command.chatType === "supergroup";

  switch (command.command) {
    case "join": {
      // A join link posted in a group could be opened by someone else, which
      // would attach their app account to this person's Telegram.
      if (!isPrivate) {
        await reply(JOIN_IN_PRIVATE_MESSAGE);
        return;
      }
      const token = await createLinkToken({
        kind: "person",
        telegramUserId: command.fromId,
        displayName: command.fromName,
      });
      if (token) {
        await reply(
          joinLinkMessage(`${appUrl()}/telegram/link?token=${token}`, LINK_TOKEN_MINUTES),
        );
      }
      return;
    }
    case "linkgroup": {
      if (!isGroup) {
        await reply(LINKGROUP_IN_GROUP_MESSAGE);
        return;
      }
      const token = await createLinkToken({
        kind: "group",
        telegramChatId: command.chatId,
        displayName: command.chatTitle ?? "Telegram group",
      });
      if (token) {
        await reply(
          groupLinkMessage(`${appUrl()}/telegram/link?token=${token}`, LINK_TOKEN_MINUTES),
        );
      }
      return;
    }
    case "start":
    case "help":
      if (isPrivate) await reply(HELP_MESSAGE);
      return;
    default:
      // Unknown commands are probably meant for another bot. Stay quiet.
      return;
  }
}
