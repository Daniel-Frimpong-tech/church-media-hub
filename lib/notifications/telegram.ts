import "server-only";

import { outstandingByPerson, outstandingTasks } from "@/lib/domain/assignments";
import { dueReminderStage, reminderDueAt } from "@/lib/domain/reminders";
import { formatChurchDate, formatChurchDateTime } from "@/lib/domain/time";
import { appUrl, telegramBotToken } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage } from "@/lib/telegram/client";
import {
  handoffLateMessage,
  handoffReadyMessage,
  serviceCreatedMessage,
  uploadReminderMessage,
  type Recipient,
  type ReminderTarget,
} from "@/lib/telegram/messages";

/**
 * Everything the app posts to the team's Telegram group. All of it runs on the
 * server with the secret key, because scheduled jobs have no signed-in user.
 *
 * Nothing here throws to its caller for a Telegram problem: a failed message
 * must never break creating a service or finishing an upload.
 */

const UNIQUE_VIOLATION = "23505";
const SWEEP_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

type Group = { chatId: number; linkedAt: Date };

async function getGroup(): Promise<Group | null> {
  if (!telegramBotToken()) return null;
  const { data } = await createAdminClient()
    .from("app_settings")
    .select("telegram_chat_id, telegram_linked_at")
    .maybeSingle();
  if (!data?.telegram_chat_id || !data.telegram_linked_at) return null;
  return { chatId: data.telegram_chat_id, linkedAt: new Date(data.telegram_linked_at) };
}

/**
 * Sends a message at most once per key. The log row is inserted first; the
 * unique key means only one caller wins, however many jobs run at once. If
 * Telegram then refuses the message, the row is removed so it is tried again.
 */
async function sendOnce(
  group: Group,
  kind: string,
  dedupeKey: string,
  serviceId: string | null,
  html: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const claim = await admin
    .from("notification_log")
    .insert({ kind, dedupe_key: dedupeKey, service_id: serviceId });
  if (claim.error) {
    if (claim.error.code !== UNIQUE_VIOLATION) {
      console.error("Could not record notification", claim.error.message);
    }
    return false;
  }

  const sent = await sendMessage(group.chatId, html);
  if (!sent.ok) {
    console.error(`Telegram ${kind} failed: ${sent.description}`);
    await admin.from("notification_log").delete().eq("dedupe_key", dedupeKey);
    return false;
  }
  return true;
}

/** Marks a key as handled without sending, e.g. a reminder with nobody to chase. */
async function markHandled(kind: string, dedupeKey: string, serviceId: string): Promise<void> {
  await createAdminClient()
    .from("notification_log")
    .upsert(
      { kind, dedupe_key: dedupeKey, service_id: serviceId },
      { onConflict: "dedupe_key", ignoreDuplicates: true },
    );
}

function serviceInfo(service: { id: string; name: string; starts_at: string }) {
  return {
    name: service.name,
    date: formatChurchDate(service.starts_at),
    url: `${appUrl()}/services/${service.id}`,
  };
}

/** Posts "folders are ready" with a link to the service. Once per service. */
export async function announceServiceCreated(serviceId: string): Promise<void> {
  try {
    const group = await getGroup();
    if (!group) return;
    const { data: service } = await createAdminClient()
      .from("services")
      .select("id, name, starts_at, drive_folder_status")
      .eq("id", serviceId)
      .maybeSingle();
    if (!service || service.drive_folder_status !== "ready") return;

    await sendOnce(
      group,
      "service_created",
      `service_created:${service.id}`,
      service.id,
      serviceCreatedMessage(serviceInfo(service)),
    );
  } catch (error) {
    console.error("Announcing a service failed", error);
  }
}

/** Who still owes what for a service, ready to be tagged. */
async function reminderTargets(serviceId: string): Promise<ReminderTarget[]> {
  const admin = createAdminClient();
  const { data: assignments } = await admin
    .from("assignments")
    .select("id, profile_id")
    .eq("service_id", serviceId);
  if (!assignments || assignments.length === 0) return [];

  const [tasks, uploads, categories, people] = await Promise.all([
    admin
      .from("assignment_categories")
      .select("assignment_id, category_id, done_at")
      .in("assignment_id", assignments.map((assignment) => assignment.id)),
    admin
      .from("uploads")
      .select("category_id, uploaded_by")
      .eq("service_id", serviceId)
      .eq("status", "complete"),
    admin.from("categories").select("id, name"),
    admin
      .from("profiles")
      .select("id, full_name, telegram_user_id, active")
      .in("id", assignments.map((assignment) => assignment.profile_id)),
  ]);

  const profileByAssignment = new Map(
    assignments.map((assignment) => [assignment.id, assignment.profile_id]),
  );
  const categoryName = new Map((categories.data ?? []).map((row) => [row.id, row.name]));
  const person = new Map((people.data ?? []).map((row) => [row.id, row]));

  const outstanding = outstandingTasks(
    (tasks.data ?? []).map((task) => ({
      assignmentId: task.assignment_id,
      serviceId,
      profileId: profileByAssignment.get(task.assignment_id) ?? "",
      categoryId: task.category_id,
      doneAt: task.done_at,
    })),
    (uploads.data ?? []).map((upload) => ({
      serviceId,
      categoryId: upload.category_id,
      uploadedBy: upload.uploaded_by,
    })),
  );

  return outstandingByPerson(outstanding).flatMap((entry) => {
    const profile = person.get(entry.profileId);
    // Do not chase someone whose access has been turned off.
    if (!profile?.active) return [];
    return [
      {
        name: profile.full_name,
        telegramUserId: profile.telegram_user_id,
        categories: entry.categoryIds.map((id) => categoryName.get(id) ?? "a category"),
      },
    ];
  });
}

export type ReminderOutcome =
  | "sent"
  | "nothing_outstanding"
  | "not_linked"
  | "already_sent"
  | "failed";

/**
 * Sends the upload reminder for a service. `key` decides how often: scheduled
 * reminders use one key per stage, the admin's "send now" button a fresh one.
 */
export async function sendUploadReminder(
  serviceId: string,
  key: string,
): Promise<ReminderOutcome> {
  try {
    const group = await getGroup();
    if (!group) return "not_linked";

    const { data: service } = await createAdminClient()
      .from("services")
      .select("id, name, starts_at")
      .eq("id", serviceId)
      .maybeSingle();
    if (!service) return "failed";

    const message = uploadReminderMessage(
      serviceInfo(service),
      await reminderTargets(serviceId),
    );
    if (!message) {
      await markHandled("upload_reminder", key, serviceId);
      return "nothing_outstanding";
    }
    return (await sendOnce(group, "upload_reminder", key, serviceId, message))
      ? "sent"
      : "already_sent";
  } catch (error) {
    console.error("Sending an upload reminder failed", error);
    return "failed";
  }
}

export type SweepResult = {
  linked: boolean;
  reminders: number;
  ready: number;
  late: number;
};

/**
 * Sends everything that has fallen due: upload reminders, "ready for your
 * team" notices and late-handoff flags. Safe to run as often as you like.
 *
 * Nothing that fell due before the group was linked is sent, so linking the
 * group does not unleash a backlog of old alerts.
 */
export async function sendDueNotifications(now: Date = new Date()): Promise<SweepResult> {
  const result: SweepResult = { linked: false, reminders: 0, ready: 0, late: 0 };
  try {
    const group = await getGroup();
    if (!group) return result;
    result.linked = true;

    const admin = createAdminClient();
    const since = new Date(now.getTime() - SWEEP_WINDOW_MS).toISOString();
    const { data: services } = await admin
      .from("services")
      .select("id, name, starts_at")
      .gte("starts_at", since)
      .lte("starts_at", now.toISOString());
    const recent = services ?? [];

    // ── Upload reminders ──
    for (const service of recent) {
      const startsAt = new Date(service.starts_at);
      const stage = dueReminderStage(startsAt, now);
      if (stage === 0 || reminderDueAt(startsAt, stage) < group.linkedAt) continue;

      const outcome = await sendUploadReminder(
        service.id,
        `upload_reminder:${service.id}:${stage}`,
      );
      if (outcome === "sent") result.reminders += 1;
      // If stage 2 is due, stage 1 is moot: never send it late.
      for (let earlier = 1; earlier < stage; earlier++) {
        await markHandled("upload_reminder", `upload_reminder:${service.id}:${earlier}`, service.id);
      }
    }

    // ── Handoffs ──
    // Upcoming services can have ready handoffs too, so look at all open ones
    // for services in the window or still to come.
    const { data: handoffs } = await admin
      .from("handoffs")
      .select("*")
      .is("received_at", null)
      .gte("due_at", since);
    const open = handoffs ?? [];
    if (open.length === 0) return result;

    const unique = (values: string[]) => [...new Set(values)];
    const [handoffServices, categories, teams, members] = await Promise.all([
      admin
        .from("services")
        .select("id, name, starts_at")
        .in("id", unique(open.map((handoff) => handoff.service_id))),
      admin.from("categories").select("id, name, slug"),
      admin.from("teams").select("id, name"),
      admin
        .from("team_members")
        .select("team_id, profile_id")
        .in("team_id", unique(open.map((handoff) => handoff.team_id))),
    ]);
    const memberIds = unique((members.data ?? []).map((member) => member.profile_id));
    const { data: memberProfiles } =
      memberIds.length > 0
        ? await admin
            .from("profiles")
            .select("id, full_name, telegram_user_id, active")
            .in("id", memberIds)
        : { data: [] };

    const serviceById = new Map((handoffServices.data ?? []).map((row) => [row.id, row]));
    const categoryById = new Map((categories.data ?? []).map((row) => [row.id, row]));
    const teamById = new Map((teams.data ?? []).map((row) => [row.id, row]));
    const profileById = new Map((memberProfiles ?? []).map((row) => [row.id, row]));
    const teamMembers = (teamId: string): Recipient[] =>
      (members.data ?? [])
        .filter((member) => member.team_id === teamId)
        .flatMap((member) => {
          const profile = profileById.get(member.profile_id);
          return profile?.active
            ? [{ name: profile.full_name, telegramUserId: profile.telegram_user_id }]
            : [];
        });

    for (const handoff of open) {
      const service = serviceById.get(handoff.service_id);
      const category = categoryById.get(handoff.category_id);
      const team = teamById.get(handoff.team_id);
      if (!service || !category || !team) continue;

      const info = {
        categoryName: category.name,
        teamName: team.name,
        service: serviceInfo(service),
        due: formatChurchDateTime(handoff.due_at),
        albumUrl: `${appUrl()}/services/${service.id}/${category.slug}`,
        teamMembers: teamMembers(team.id),
      };
      const dueAt = new Date(handoff.due_at);
      const readyAt = handoff.ready_at ? new Date(handoff.ready_at) : null;

      if (dueAt < now && dueAt >= group.linkedAt) {
        const sent = await sendOnce(
          group,
          "handoff_late",
          `handoff_late:${handoff.id}`,
          service.id,
          handoffLateMessage({ ...info, isReady: readyAt !== null }),
        );
        if (sent) result.late += 1;
      } else if (readyAt && readyAt >= group.linkedAt && dueAt >= now) {
        // Keyed by when it became ready, so reopening a task and finishing it
        // again tells the team again.
        const sent = await sendOnce(
          group,
          "handoff_ready",
          `handoff_ready:${handoff.id}:${handoff.ready_at}`,
          service.id,
          handoffReadyMessage(info),
        );
        if (sent) result.ready += 1;
      }
    }
  } catch (error) {
    console.error("Sending due notifications failed", error);
  }
  return result;
}
