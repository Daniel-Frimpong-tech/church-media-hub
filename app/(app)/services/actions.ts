"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { requireAdmin, requireProfile } from "@/lib/auth";
import { churchLocalToUtc, serviceFolderName } from "@/lib/domain/time";
import { getDriveSession } from "@/lib/google/connection";
import { moveToBin, renameFile } from "@/lib/google/drive";
import type { FormState } from "@/lib/form-state";
import {
  announceServiceCreated,
  sendDueNotifications,
  sendUploadReminder,
} from "@/lib/notifications/telegram";
import { ensureServiceFolders } from "@/lib/services/folders";
import { createClient } from "@/lib/supabase/server";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function createService(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const name = text(formData, "name");
  if (!name) return { error: "Give the service a name." };
  if (name.length > 80) return { error: "Keep the name under 80 characters." };

  const startsAt = churchLocalToUtc(text(formData, "date"), text(formData, "time"));
  if (!startsAt) return { error: "Choose a valid date and time." };

  const supabase = await createClient();
  const { data: service, error } = await supabase
    .from("services")
    .insert({ name, starts_at: startsAt.toISOString(), created_by: admin.id })
    .select("id")
    .single();
  if (error || !service) {
    return { error: "Could not save the service. Check your connection and try again." };
  }

  // The service is saved either way. If Drive fails, the service page shows
  // why and offers a retry, so a Google hiccup never loses the service.
  const folders = await ensureServiceFolders(supabase, service.id);
  // Tell the team group, after the response so Telegram never slows this down.
  if (folders.ok) after(() => announceServiceCreated(service.id));

  revalidatePath("/services");
  revalidatePath("/dashboard");
  redirect(`/services/${service.id}`);
}

export async function retryServiceFolders(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const serviceId = text(formData, "service_id");
  if (!serviceId) return { error: "Service not found." };

  const supabase = await createClient();
  const result = await ensureServiceFolders(supabase, serviceId);

  revalidatePath(`/services/${serviceId}`);
  revalidatePath("/services");
  if (!result.ok) return { error: result.message };
  after(() => announceServiceCreated(serviceId));
  return { success: "Drive folders are ready." };
}

const UNIQUE_VIOLATION = "23505";
const GENERIC_ERROR = "Could not save. Check your connection and try again.";

function refreshService(serviceId: string): void {
  revalidatePath(`/services/${serviceId}`);
  revalidatePath("/services");
  revalidatePath("/dashboard");
  revalidatePath("/handoffs");
}

export async function updateService(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const serviceId = text(formData, "service_id");
  const name = text(formData, "name");
  if (!serviceId) return { error: "Service not found." };
  if (!name) return { error: "Give the service a name." };
  if (name.length > 80) return { error: "Keep the name under 80 characters." };

  const startsAt = churchLocalToUtc(text(formData, "date"), text(formData, "time"));
  if (!startsAt) return { error: "Choose a valid date and time." };

  const supabase = await createClient();
  const { data: service, error } = await supabase
    .from("services")
    .update({ name, starts_at: startsAt.toISOString() })
    .eq("id", serviceId)
    .select("drive_folder_id")
    .maybeSingle();
  if (error || !service) return { error: GENERIC_ERROR };

  // Keep the Drive folder's name in step. If Google is unreachable the service
  // is still updated; only the folder keeps its old name.
  let folderRenamed = true;
  if (service.drive_folder_id) {
    try {
      const { accessToken } = await getDriveSession();
      await renameFile(
        accessToken,
        service.drive_folder_id,
        serviceFolderName(name, startsAt),
      );
    } catch (renameError) {
      console.error("Renaming the Drive folder failed", renameError);
      folderRenamed = false;
    }
  }

  refreshService(serviceId);
  return {
    success: folderRenamed
      ? "Saved."
      : "Saved. The Google Drive folder kept its old name because Drive could not be reached.",
  };
}

export async function deleteService(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const serviceId = text(formData, "service_id");
  if (!serviceId) return { error: "Service not found." };

  const supabase = await createClient();
  const { count } = await supabase
    .from("uploads")
    .select("id", { count: "exact", head: true })
    .eq("service_id", serviceId);
  if ((count ?? 0) > 0) {
    return {
      error:
        "This service has uploads, so it cannot be deleted. That protects the record of who uploaded what.",
    };
  }

  const { data: service } = await supabase
    .from("services")
    .select("drive_folder_id")
    .eq("id", serviceId)
    .maybeSingle();
  const { error } = await supabase.from("services").delete().eq("id", serviceId);
  if (error) return { error: GENERIC_ERROR };

  // The folder is empty (no uploads). Move it to the Drive bin so it does not
  // linger; it can be restored from there for 30 days.
  if (service?.drive_folder_id) {
    try {
      const { accessToken } = await getDriveSession();
      await moveToBin(accessToken, service.drive_folder_id);
    } catch (binError) {
      console.error("Moving the Drive folder to the bin failed", binError);
    }
  }

  revalidatePath("/services");
  revalidatePath("/dashboard");
  redirect("/services");
}

export async function addAssignment(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const serviceId = text(formData, "service_id");
  const profileId = text(formData, "profile_id");
  const dutyRoleId = text(formData, "duty_role_id");
  const categoryIds = formData
    .getAll("category_ids")
    .filter((value): value is string => typeof value === "string" && value !== "");
  if (!serviceId) return { error: "Service not found." };
  if (!profileId) return { error: "Choose a person." };
  if (!dutyRoleId) return { error: "Choose what they are doing." };
  if (categoryIds.length === 0) {
    return { error: "Tick at least one category they should upload." };
  }

  const supabase = await createClient();
  const { data: assignment, error } = await supabase
    .from("assignments")
    .insert({ service_id: serviceId, profile_id: profileId, duty_role_id: dutyRoleId })
    .select("id")
    .single();
  if (error || !assignment) {
    if (error?.code === UNIQUE_VIOLATION) {
      return { error: "They already have that role at this service. Remove it first to change it." };
    }
    return { error: GENERIC_ERROR };
  }

  const { error: categoriesError } = await supabase
    .from("assignment_categories")
    .insert(
      categoryIds.map((categoryId) => ({
        assignment_id: assignment.id,
        category_id: categoryId,
      })),
    );
  if (categoriesError) {
    // Do not leave an assignment with no categories behind.
    await supabase.from("assignments").delete().eq("id", assignment.id);
    return { error: GENERIC_ERROR };
  }

  refreshService(serviceId);
  return { success: "Assigned." };
}

export async function removeAssignment(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();

  const assignmentId = text(formData, "assignment_id");
  const serviceId = text(formData, "service_id");
  if (!assignmentId) return { error: "Assignment not found." };

  const supabase = await createClient();
  const { error } = await supabase.from("assignments").delete().eq("id", assignmentId);
  if (error) return { error: GENERIC_ERROR };

  if (serviceId) refreshService(serviceId);
  return {};
}

export async function setTaskDone(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireProfile();

  const assignmentId = text(formData, "assignment_id");
  const categoryId = text(formData, "category_id");
  const serviceId = text(formData, "service_id");
  if (!assignmentId || !categoryId) return { error: "Task not found." };

  // The database function checks the caller owns the task (or is an admin).
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_task_done", {
    p_assignment_id: assignmentId,
    p_category_id: categoryId,
    p_done: text(formData, "done") === "true",
  });
  if (error) {
    return {
      error: error.message.includes("not_allowed")
        ? "Only the person assigned, or an admin, can change this task."
        : GENERIC_ERROR,
    };
  }

  // Marking a task done can make a category ready for its team.
  after(() => sendDueNotifications());

  if (serviceId) refreshService(serviceId);
  return {};
}

const REMINDER_OUTCOMES: Record<string, FormState> = {
  sent: { success: "Reminder posted in the Telegram group." },
  nothing_outstanding: { success: "Nobody has anything outstanding, so nothing was sent." },
  not_linked: {
    error: "Telegram is not set up yet. Finish the steps under Admin → Telegram.",
  },
  already_sent: { error: "Telegram did not accept the message. Try again in a minute." },
  failed: { error: "Could not send the reminder. Try again." },
};

/** An admin presses "Send reminder now" on a service page. */
export async function sendReminderNow(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const serviceId = text(formData, "service_id");
  if (!serviceId) return { error: "Service not found." };

  // A fresh key each minute: pressing twice by accident sends once.
  const minute = new Date().toISOString().slice(0, 16);
  const outcome = await sendUploadReminder(
    serviceId,
    `upload_reminder:${serviceId}:manual:${minute}`,
  );
  return REMINDER_OUTCOMES[outcome] ?? REMINDER_OUTCOMES.failed;
}

export async function setHandoffReceived(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireProfile();

  const handoffId = text(formData, "handoff_id");
  const serviceId = text(formData, "service_id");
  if (!handoffId) return { error: "Handoff not found." };

  // The database function checks the caller is on the receiving team (or an admin).
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_handoff_received", {
    p_handoff_id: handoffId,
    p_received: text(formData, "received") === "true",
  });
  if (error) {
    return {
      error: error.message.includes("not_allowed")
        ? "Only someone on the receiving team, or an admin, can do this."
        : GENERIC_ERROR,
    };
  }

  if (serviceId) refreshService(serviceId);
  else revalidatePath("/handoffs");
  return {};
}
