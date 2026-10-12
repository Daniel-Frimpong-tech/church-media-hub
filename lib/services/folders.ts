import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceFolderName } from "@/lib/domain/time";
import {
  getDriveSession,
  GoogleNotConnectedError,
  markGoogleConnectionExpired,
} from "@/lib/google/connection";
import { createFolder } from "@/lib/google/drive";
import { GoogleConnectionExpiredError } from "@/lib/google/oauth";
import type { Database } from "@/lib/supabase/database.types";

export type FolderProblem = "not_connected" | "expired" | "drive_error";

export type FolderResult =
  | { ok: true }
  | { ok: false; problem: FolderProblem; message: string };

const MESSAGES: Record<FolderProblem, string> = {
  not_connected:
    "The church Google account is not connected yet, so no Drive folders were created.",
  expired:
    "The church Google account needs to be reconnected before Drive folders can be created.",
  drive_error: "Google Drive did not respond as expected. Try again in a minute.",
};

/**
 * Makes sure a service has its Drive folder and one subfolder per active
 * category. Safe to run again after a failure: each folder ID is saved as soon
 * as it exists, so a retry only creates what is still missing.
 *
 * The caller passes the Supabase client: the signed-in admin's for the UI, or
 * the secret-key client for scheduled jobs.
 */
export async function ensureServiceFolders(
  supabase: SupabaseClient<Database>,
  serviceId: string,
): Promise<FolderResult> {
  const [service, categories, existing] = await Promise.all([
    supabase.from("services").select("*").eq("id", serviceId).single(),
    supabase
      .from("categories")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("service_folders")
      .select("category_id")
      .eq("service_id", serviceId),
  ]);
  const loadError = service.error ?? categories.error ?? existing.error;
  if (loadError || !service.data) {
    return {
      ok: false,
      problem: "drive_error",
      message: "Could not load the service.",
    };
  }

  try {
    const { accessToken, rootFolderId } = await getDriveSession();

    let serviceFolderId = service.data.drive_folder_id;
    if (!serviceFolderId) {
      serviceFolderId = await createFolder(
        accessToken,
        serviceFolderName(service.data.name, service.data.starts_at),
        rootFolderId,
      );
      const saved = await supabase
        .from("services")
        .update({ drive_folder_id: serviceFolderId })
        .eq("id", serviceId);
      if (saved.error) throw new Error(saved.error.message);
    }

    const done = new Set((existing.data ?? []).map((row) => row.category_id));
    for (const category of categories.data ?? []) {
      if (done.has(category.id)) continue;
      const folderId = await createFolder(
        accessToken,
        category.name,
        serviceFolderId,
      );
      const saved = await supabase.from("service_folders").insert({
        service_id: serviceId,
        category_id: category.id,
        drive_folder_id: folderId,
      });
      if (saved.error) throw new Error(saved.error.message);
    }

    await supabase
      .from("services")
      .update({ drive_folder_status: "ready", drive_error: null })
      .eq("id", serviceId);
    return { ok: true };
  } catch (error) {
    let problem: FolderProblem = "drive_error";
    if (error instanceof GoogleNotConnectedError) {
      problem = "not_connected";
    } else if (error instanceof GoogleConnectionExpiredError) {
      problem = "expired";
      await markGoogleConnectionExpired("Google rejected the saved sign-in.");
    } else {
      console.error("Creating Drive folders failed", error);
    }

    await supabase
      .from("services")
      .update({ drive_folder_status: "failed", drive_error: MESSAGES[problem] })
      .eq("id", serviceId);
    return { ok: false, problem, message: MESSAGES[problem] };
  }
}
