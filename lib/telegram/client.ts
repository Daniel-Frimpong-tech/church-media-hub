import "server-only";

import { telegramBotToken } from "@/lib/env";

/**
 * Thin wrapper over the Telegram Bot API. Every function is a no-op that
 * reports "not configured" when the bot token is missing, so the rest of the
 * app never has to care whether Telegram is set up.
 */

export type TelegramResult<T> =
  | { ok: true; result: T }
  | { ok: false; reason: "not_configured" | "telegram_error"; description: string };

async function call<T>(method: string, body: Record<string, unknown>): Promise<TelegramResult<T>> {
  const token = telegramBotToken();
  if (!token) {
    return { ok: false, reason: "not_configured", description: "TELEGRAM_BOT_TOKEN is not set." };
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const data = (await response.json()) as {
      ok: boolean;
      result?: T;
      description?: string;
    };
    if (!data.ok || data.result === undefined) {
      return {
        ok: false,
        reason: "telegram_error",
        description: data.description ?? `HTTP ${response.status}`,
      };
    }
    return { ok: true, result: data.result };
  } catch (error) {
    // Never include the request URL in errors: it contains the bot token.
    return {
      ok: false,
      reason: "telegram_error",
      description: error instanceof Error ? error.name : "Network error",
    };
  }
}

export function sendMessage(
  chatId: number,
  html: string,
  options: { replyToMessageId?: number } = {},
): Promise<TelegramResult<{ message_id: number }>> {
  return call("sendMessage", {
    chat_id: chatId,
    text: html,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    ...(options.replyToMessageId
      ? { reply_parameters: { message_id: options.replyToMessageId, allow_sending_without_reply: true } }
      : {}),
  });
}

/** Replaces the text of a message the bot sent earlier. */
export function editMessageText(
  chatId: number,
  messageId: number,
  html: string,
): Promise<TelegramResult<unknown>> {
  return call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: html,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  });
}

export function getMe(): Promise<TelegramResult<{ username: string; first_name: string }>> {
  return call("getMe", {});
}

export type WebhookInfo = {
  url: string;
  pending_update_count: number;
  last_error_message?: string;
};

export function getWebhookInfo(): Promise<TelegramResult<WebhookInfo>> {
  return call("getWebhookInfo", {});
}

/** Tells Telegram where to deliver messages, and the secret to send with them. */
export function setWebhook(url: string, secretToken: string): Promise<TelegramResult<true>> {
  return call("setWebhook", {
    url,
    secret_token: secretToken,
    // Only what the bot acts on.
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
}
