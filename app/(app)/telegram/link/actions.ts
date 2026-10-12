"use server";

import { revalidatePath } from "next/cache";
import { getProfile } from "@/lib/auth";
import type { FormState } from "@/lib/form-state";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage } from "@/lib/telegram/client";
import { consumeLinkToken, findLinkToken } from "@/lib/telegram/link-tokens";

const EXPIRED =
  "This link has expired or was already used. Send the command to the bot again for a new one.";

/** Runs when the person presses Confirm on the link page. */
export async function confirmTelegramLink(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await getProfile();
  if (!profile) return { error: "Sign in first, then open the link again." };

  const token = formData.get("token");
  const link = typeof token === "string" ? await findLinkToken(token) : null;
  if (!link) return { error: EXPIRED };

  if (link.kind === "group" && profile.role !== "admin") {
    return { error: "Only an admin can link the team group." };
  }
  // Using the token is what makes the link single-use. If two people press
  // Confirm at once, only one gets past this line.
  if (!(await consumeLinkToken(link.tokenHash))) return { error: EXPIRED };

  const admin = createAdminClient();

  if (link.kind === "person" && link.telegramUserId !== null) {
    // A Telegram account can be attached to one app account. If it was on
    // another, move it.
    await admin
      .from("profiles")
      .update({ telegram_user_id: null, telegram_name: null })
      .eq("telegram_user_id", link.telegramUserId)
      .neq("id", profile.id);
    const { error } = await admin
      .from("profiles")
      .update({
        telegram_user_id: link.telegramUserId,
        telegram_name: link.displayName,
      })
      .eq("id", profile.id);
    if (error) return { error: "Could not save. Try again." };

    await sendMessage(
      link.telegramUserId,
      "✅ Connected. I can now tag you in the team group when something needs you.",
    );
    revalidatePath("/admin/telegram");
    return { success: "Connected. You can close this page and go back to Telegram." };
  }

  if (link.kind === "group" && link.telegramChatId !== null) {
    const { error } = await admin
      .from("app_settings")
      .update({
        telegram_chat_id: link.telegramChatId,
        telegram_chat_title: link.displayName,
        telegram_linked_by: profile.id,
        telegram_linked_at: new Date().toISOString(),
      })
      .eq("id", true);
    if (error) return { error: "Could not save. Try again." };

    await sendMessage(
      link.telegramChatId,
      "✅ This group is now linked to RCW Media. I will post new services, upload reminders and handoffs here.\n\nEveryone: send me /join in a private chat so I can tag you.",
    );
    revalidatePath("/admin/telegram");
    return { success: "Group linked. The bot has posted a confirmation there." };
  }

  return { error: EXPIRED };
}
