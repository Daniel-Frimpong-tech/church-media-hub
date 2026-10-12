import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Marks uploads that never finished as failed. Google keeps an unfinished
 * upload session for about a week; after that it cannot be resumed, so the
 * record is closed off rather than left saying "uploading" forever.
 */
export async function closeAbandonedUploads(now: Date): Promise<number> {
  const { data } = await createAdminClient()
    .from("uploads")
    .update({ status: "failed" })
    .eq("status", "uploading")
    .lt("created_at", new Date(now.getTime() - 8 * DAY_MS).toISOString())
    .select("id");
  return data?.length ?? 0;
}

/** Removes one-time Telegram links that expired more than a day ago. */
export async function removeExpiredLinkTokens(now: Date): Promise<number> {
  const { data } = await createAdminClient()
    .from("telegram_link_tokens")
    .delete()
    .lt("expires_at", new Date(now.getTime() - DAY_MS).toISOString())
    .select("token_hash");
  return data?.length ?? 0;
}
