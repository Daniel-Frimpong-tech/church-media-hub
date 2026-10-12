import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
  const [service, categories, folders] = await Promise.all([
    supabase.from("services").select("*").eq("id", id).maybeSingle(),
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("service_folders").select("category_id").eq("service_id", id),
  ]);
  const failed = service.error ?? categories.error ?? folders.error;
  if (failed) throw new Error(`Could not load the service: ${failed.message}`);
  if (!service.data) notFound();

  const canManage = can(profile.role, "manage_services");
  const withFolder = new Set(folders.data.map((row) => row.category_id));
  // Show active categories, plus retired ones this service already has.
  const shown = categories.data.filter(
    (category) => category.is_active || withFolder.has(category.id),
  );
  const missing = shown.filter(
    (category) => category.is_active && !withFolder.has(category.id),
  );
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

      <Card className="flex flex-col gap-3">
        <h2 className="text-title-lg text-ink">Categories</h2>
        <ul className="divide-y divide-hairline-soft">
          {shown.map((category) => (
            <li
              key={category.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <span className="text-body text-ink">{category.name}</span>
              {withFolder.has(category.id) ? (
                <Badge tone="success">Folder ready</Badge>
              ) : (
                <Badge tone="warning">No folder yet</Badge>
              )}
            </li>
          ))}
        </ul>
        <p className="text-body-sm text-muted">
          Uploading and the photo gallery arrive in the next update.
        </p>
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
    </div>
  );
}
