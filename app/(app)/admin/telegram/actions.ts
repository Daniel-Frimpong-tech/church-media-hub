"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { appUrl, telegramWebhookSecret } from "@/lib/env";
import type { FormState } from "@/lib/form-state";
import { createAdminClient } from "@/lib/supabase/admin";
import { setWebhook } from "@/lib/telegram/client";

/** Tells Telegram to deliver the bot's messages to this app. */
export async function registerWebhook(
  _previous: FormState,
  _formData: FormData,
): Promise<FormState> {
  void _previous;
  void _formData;
  await requireAdmin();

  const secret = telegramWebhookSecret();
  if (!secret) return { error: "TELEGRAM_WEBHOOK_SECRET is not set on the server." };

  const url = `${appUrl()}/api/telegram/webhook`;
  if (!url.startsWith("https://")) {
    return {
      error:
        "Telegram can only reach a public https address. Do this on the live site, not on localhost.",
    };
  }

  const result = await setWebhook(url, secret);
  if (!result.ok) {
    return {
      error:
        result.reason === "not_configured"
          ? "TELEGRAM_BOT_TOKEN is not set on the server."
          : `Telegram refused: ${result.description}`,
    };
  }
  revalidatePath("/admin/telegram");
  return { success: "Connected. Telegram will now deliver the bot's messages here." };
}

export async function unlinkGroup(
  _previous: FormState,
  _formData: FormData,
): Promise<FormState> {
  void _previous;
  void _formData;
  await requireAdmin();
  const { error } = await createAdminClient()
    .from("app_settings")
    .update({
      telegram_chat_id: null,
      telegram_chat_title: null,
      telegram_linked_by: null,
      telegram_linked_at: null,
    })
    .eq("id", true);
  if (error) return { error: "Could not save. Try again." };
  revalidatePath("/admin/telegram");
  return { success: "Group unlinked. The bot will not post until a group is linked again." };
}
