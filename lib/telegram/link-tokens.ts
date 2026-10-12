import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const LINK_TOKEN_MINUTES = 15;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

type NewLink =
  | { kind: "person"; telegramUserId: number; displayName: string }
  | { kind: "group"; telegramChatId: number; displayName: string };

/**
 * Creates a one-time link token. The token itself goes into the link the bot
 * sends; only its hash is stored, so the database never holds a usable link.
 */
export async function createLinkToken(link: NewLink): Promise<string | null> {
  const token = randomBytes(32).toString("base64url");
  const { error } = await createAdminClient()
    .from("telegram_link_tokens")
    .insert({
      token_hash: hashToken(token),
      kind: link.kind,
      telegram_user_id: link.kind === "person" ? link.telegramUserId : null,
      telegram_chat_id: link.kind === "group" ? link.telegramChatId : null,
      display_name: link.displayName.slice(0, 120),
      expires_at: new Date(Date.now() + LINK_TOKEN_MINUTES * 60_000).toISOString(),
    });
  if (error) {
    console.error("Could not create Telegram link token", error.message);
    return null;
  }
  return token;
}

export type PendingLink = {
  tokenHash: string;
  kind: "person" | "group";
  telegramUserId: number | null;
  telegramChatId: number | null;
  displayName: string;
};

/** Looks a token up without using it. Null if unknown, used or expired. */
export async function findLinkToken(token: string): Promise<PendingLink | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const { data } = await createAdminClient()
    .from("telegram_link_tokens")
    .select("*")
    .eq("token_hash", hashToken(token))
    .maybeSingle();
  if (!data || data.used_at || new Date(data.expires_at).getTime() < Date.now()) {
    return null;
  }
  return {
    tokenHash: data.token_hash,
    kind: data.kind,
    telegramUserId: data.telegram_user_id,
    telegramChatId: data.telegram_chat_id,
    displayName: data.display_name,
  };
}

/**
 * Marks a token used. Returns false if someone else used it first: the update
 * only matches a row that is still unused, so two clicks cannot both win.
 */
export async function consumeLinkToken(tokenHash: string): Promise<boolean> {
  const { data } = await createAdminClient()
    .from("telegram_link_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("token_hash", tokenHash)
    .is("used_at", null)
    .gt("expires_at", new Date().toISOString())
    .select("token_hash");
  return (data?.length ?? 0) === 1;
}
