import "server-only";

import type { UploadService } from "@/components/upload/upload-provider";
import { pickFocusService, relativeDay } from "@/lib/domain/analytics";
import { can } from "@/lib/domain/permissions";
import { currentTime, formatChurchDate, recentCutoff } from "@/lib/domain/time";
import type { Profile } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

const DAY_MS = 24 * 60 * 60 * 1000;

export type UploadTargets = {
  services: UploadService[];
  /** The service the sheet opens on: the one people are most likely here for. */
  defaultServiceId: string | null;
};

/**
 * The services someone can upload to from the upload sheet: those from the
 * last two weeks and the coming week whose Drive folders exist. Null for
 * people who cannot upload.
 */
export async function loadUploadTargets(profile: Profile): Promise<UploadTargets | null> {
  if (!can(profile.role, "upload_media")) return null;

  const supabase = await createClient();
  const now = currentTime();
  const { data: services } = await supabase
    .from("services")
    .select("id, name, starts_at")
    .gte("starts_at", recentCutoff(now))
    .lte("starts_at", new Date(now.getTime() + 7 * DAY_MS).toISOString())
    .order("starts_at", { ascending: false })
    .limit(12);
  if (!services || services.length === 0) {
    return { services: [], defaultServiceId: null };
  }

  const [folders, categories] = await Promise.all([
    supabase
      .from("service_folders")
      .select("service_id, category_id")
      .in(
        "service_id",
        services.map((service) => service.id),
      ),
    supabase
      .from("categories")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order"),
  ]);
  const withFolder = new Set(
    (folders.data ?? []).map((row) => `${row.service_id}:${row.category_id}`),
  );

  const ready = services
    .map((service) => ({
      id: service.id,
      name: service.name,
      startsAt: service.starts_at,
      dateLine: formatChurchDate(service.starts_at).replace(/, \d{4}$/, ""),
      relative: relativeDay(service.starts_at, now),
      categories: (categories.data ?? []).filter((category) =>
        withFolder.has(`${service.id}:${category.id}`),
      ),
    }))
    .filter((service) => service.categories.length > 0);

  const focus = pickFocusService(
    ready.map((service) => ({ id: service.id, startsAt: service.startsAt })),
    now,
  );
  // The default goes first so it is visible without scrolling the picker.
  ready.sort((a, b) => Number(b.id === focus?.id) - Number(a.id === focus?.id));

  return {
    services: ready.map((service) => ({
      id: service.id,
      name: service.name,
      dateLine: service.dateLine,
      relative: service.relative,
      categories: service.categories,
    })),
    defaultServiceId: focus?.id ?? null,
  };
}

/**
 * One service as an upload target, or null if the person cannot upload to it
 * (no permission, no such service, or no Drive folders yet).
 */
export async function loadUploadService(
  profile: Profile,
  serviceId: string,
): Promise<UploadService | null> {
  if (!can(profile.role, "upload_media")) return null;

  const supabase = await createClient();
  const [service, folders, categories] = await Promise.all([
    supabase.from("services").select("id, name, starts_at").eq("id", serviceId).maybeSingle(),
    supabase.from("service_folders").select("category_id").eq("service_id", serviceId),
    supabase.from("categories").select("id, name").eq("is_active", true).order("sort_order"),
  ]);
  if (!service.data) return null;

  const withFolder = new Set((folders.data ?? []).map((row) => row.category_id));
  const available = (categories.data ?? []).filter((category) => withFolder.has(category.id));
  if (available.length === 0) return null;

  return {
    id: service.data.id,
    name: service.data.name,
    dateLine: formatChurchDate(service.data.starts_at).replace(/, \d{4}$/, ""),
    relative: relativeDay(service.data.starts_at, currentTime()),
    categories: available,
  };
}
