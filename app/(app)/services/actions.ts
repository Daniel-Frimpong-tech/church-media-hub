"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { churchLocalToUtc } from "@/lib/domain/time";
import type { FormState } from "@/lib/form-state";
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
  await ensureServiceFolders(supabase, service.id);

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
  return { success: "Drive folders are ready." };
}
