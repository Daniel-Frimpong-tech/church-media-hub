import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Uploader } from "@/components/upload/uploader";
import { requireProfile } from "@/lib/auth";
import { can } from "@/lib/domain/permissions";
import { formatChurchDate, formatChurchTime } from "@/lib/domain/time";
import { getGoogleConnectionSummary } from "@/lib/google/connection";
import { driveFolderUrl } from "@/lib/google/links";
import { createClient } from "@/lib/supabase/server";
import { RetryFolders } from "./retry-folders";

export const metadata: Metadata = { title: "Service" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ServicePage({
  params,
}: PageProps<"/services/[id]">) {
  const profile = await requireProfile();
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();
  const [service, categories, folders, uploads] = await Promise.all([
    supabase.from("services").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("service_folders").select("category_id").eq("service_id", id),
    // Row Level Security already limits viewers to their teams' categories.
    supabase
      .from("uploads")
      .select("id, category_id, uploaded_by, file_name, completed_at")
      .eq("service_id", id)
      .eq("status", "complete")
      .order("completed_at", { ascending: false }),
  ]);
  const failed =
    service.error ?? categories.error ?? folders.error ?? uploads.error;
  if (failed) throw new Error(`Could not load the service: ${failed.message}`);
  if (!service.data) notFound();

  const canManage = can(profile.role, "manage_services");
  const canUpload = can(profile.role, "upload_media");

  const finished = uploads.data ?? [];
  const countByCategory = new Map<string, number>();
  for (const upload of finished) {
    countByCategory.set(
      upload.category_id,
      (countByCategory.get(upload.category_id) ?? 0) + 1,
    );
  }
  const recent = finished.slice(0, 10);
  const uploaderIds = [
    ...new Set(recent.map((upload) => upload.uploaded_by).filter((v) => v !== null)),
  ];
  const uploaders =
    uploaderIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", uploaderIds)
      : null;
  const nameById = new Map(
    (uploaders?.data ?? []).map((person) => [person.id, person.full_name]),
  );
  const categoryNameById = new Map(
    (categories.data ?? []).map((category) => [category.id, category.name]),
  );
  const withFolder = new Set((folders.data ?? []).map((row) => row.category_id));
  // Show active categories, plus retired ones this service already has.
  const shown = (categories.data ?? []).filter(
    (category) => category.is_active || withFolder.has(category.id),
  );
  const missing = shown.filter(
    (category) => category.is_active && !withFolder.has(category.id),
  );
  // Upload only into active categories that have a folder.
  const uploadTargets = shown
    .filter((category) => category.is_active && withFolder.has(category.id))
    .map((category) => ({ id: category.id, name: category.name }));
  const foldersIncomplete =
    service.data.drive_folder_status !== "ready" || missing.length > 0;

  // Only admins can fix the Google connection, so only they are told about it.
  const connection =
    canManage && foldersIncomplete ? await getGoogleConnectionSummary() : null;
  const needsConnection =
    canManage &&
    foldersIncomplete &&
    (!connection || connection.status === "expired");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href="/services" className="text-body-sm text-muted underline">
          Services
        </Link>
        <h1 className="text-display text-ink">{service.data.name}</h1>
        <p className="text-body text-ink-soft">
          {formatChurchDate(service.data.starts_at)} ·{" "}
          {formatChurchTime(service.data.starts_at)}
        </p>
      </div>

      {canManage && foldersIncomplete ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-md bg-danger-soft p-4"
        >
          <div className="flex flex-col gap-1">
            <p className="text-title text-danger">
              Drive folders are not ready
            </p>
            <p className="text-body-sm text-ink-soft">
              {service.data.drive_error ??
                (missing.length > 0
                  ? `Missing: ${missing.map((c) => c.name).join(", ")}.`
                  : "The folders have not been created yet.")}{" "}
              The service itself is saved.
            </p>
          </div>
          {needsConnection ? (
            <Link
              href="/admin/google"
              className={buttonClasses("primary", "md", "self-start")}
            >
              {connection ? "Reconnect Google" : "Connect Google"}
            </Link>
          ) : (
            <RetryFolders serviceId={service.data.id} label="Create folders" />
          )}
        </div>
      ) : null}

      {canUpload && uploadTargets.length > 0 ? (
        <Card className="flex flex-col gap-4">
          <h2 className="text-title-lg text-ink">Upload</h2>
          <Uploader serviceId={service.data.id} categories={uploadTargets} />
        </Card>
      ) : null}

      <Card className="flex flex-col gap-3">
        <h2 className="text-title-lg text-ink">Categories</h2>
        <ul className="divide-y divide-hairline-soft">
          {shown.map((category) => (
            <li
              key={category.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              {withFolder.has(category.id) ? (
                <Link
                  href={`/services/${id}/${category.slug}`}
                  className="text-body font-medium text-primary underline"
                >
                  {category.name}
                </Link>
              ) : (
                <span className="text-body text-ink">{category.name}</span>
              )}
              {withFolder.has(category.id) ? (
                <span className="text-body-sm text-muted tabular-nums">
                  {countByCategory.get(category.id) ?? 0}{" "}
                  {countByCategory.get(category.id) === 1 ? "file" : "files"}
                </span>
              ) : (
                <Badge tone="warning">No folder yet</Badge>
              )}
            </li>
          ))}
        </ul>
        {canManage && service.data.drive_folder_id ? (
          <a
            href={driveFolderUrl(service.data.drive_folder_id)}
            target="_blank"
            rel="noreferrer"
            className={buttonClasses("ghost", "sm", "self-start underline")}
          >
            Open in Google Drive
          </a>
        ) : null}
      </Card>

      {recent.length > 0 ? (
        <Card className="flex flex-col gap-3">
          <h2 className="text-title-lg text-ink">Latest uploads</h2>
          <ul className="divide-y divide-hairline-soft">
            {recent.map((upload) => (
              <li key={upload.id} className="flex flex-col gap-0.5 py-2">
                <span className="truncate text-body-sm font-medium text-ink">
                  {upload.file_name}
                </span>
                <span className="text-caption text-muted">
                  {categoryNameById.get(upload.category_id) ?? "Category"} ·{" "}
                  {upload.uploaded_by
                    ? (nameById.get(upload.uploaded_by) ?? "Someone")
                    : "Someone"}
                  {upload.completed_at
                    ? ` · ${formatChurchDate(upload.completed_at)}, ${formatChurchTime(upload.completed_at)}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
