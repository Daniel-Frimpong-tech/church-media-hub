import "server-only";

import { retryPendingRevocations } from "@/lib/google/grants";
import { sendDueNotifications } from "@/lib/notifications/telegram";
import { closePublicFiles } from "@/lib/share/drive";
import { createAdminClient } from "@/lib/supabase/admin";
import { closeAbandonedUploads, removeExpiredLinkTokens } from "./cleanup";
import { createRecurringServices, retryFailedFolders } from "./recurring";

export type JobResult = {
  servicesCreated: number;
  foldersFixed: number;
  /** "Today's service" posts in Telegram. */
  servicesAnnounced: number;
  reminders: number;
  readyNotices: number;
  lateNotices: number;
  telegramLinked: boolean;
  driveAccessRemoved: number;
  uploadsClosed: number;
  /** Names of steps that failed. The others still ran. */
  failed: string[];
};

/**
 * Everything that happens on a schedule. Each step is independent: if one
 * fails (say Google is down), the rest still run, and the failure is recorded
 * for admins to see.
 */
export async function runScheduledJobs(now: Date = new Date()): Promise<JobResult> {
  const result: JobResult = {
    servicesCreated: 0,
    foldersFixed: 0,
    servicesAnnounced: 0,
    reminders: 0,
    readyNotices: 0,
    lateNotices: 0,
    telegramLinked: false,
    driveAccessRemoved: 0,
    uploadsClosed: 0,
    failed: [],
  };

  const step = async (name: string, work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      console.error(`Scheduled step "${name}" failed`, error);
      result.failed.push(name);
    }
  };

  await step("create recurring services", async () => {
    result.servicesCreated = await createRecurringServices(now);
  });
  await step("retry Drive folders", async () => {
    result.foldersFixed = await retryFailedFolders(now);
  });
  await step("send notifications", async () => {
    const sweep = await sendDueNotifications(now);
    result.telegramLinked = sweep.linked;
    result.servicesAnnounced = sweep.servicesAnnounced;
    result.reminders = sweep.reminders;
    result.readyNotices = sweep.ready;
    result.lateNotices = sweep.late;
  });
  await step("remove Drive access", async () => {
    result.driveAccessRemoved = await retryPendingRevocations();
    // Files opened to "anyone with the link" for share links that have since
    // expired or been turned off.
    result.driveAccessRemoved += await closePublicFiles();
  });
  await step("clean up", async () => {
    result.uploadsClosed = await closeAbandonedUploads(now);
    await removeExpiredLinkTokens(now);
  });

  await createAdminClient()
    .from("app_settings")
    .update({ last_job_run_at: now.toISOString(), last_job_result: result })
    .eq("id", true);

  return result;
}
