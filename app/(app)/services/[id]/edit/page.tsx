import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton } from "@/components/ui/action-button";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { churchClockTime, churchIsoDate } from "@/lib/domain/time";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/uploads/api";
import { deleteService } from "../../actions";
import { EditServiceForm } from "./edit-service-form";

export const metadata: Metadata = { title: "Edit service" };

export default async function EditServicePage({
  params,
}: PageProps<"/services/[id]/edit">) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const supabase = await createClient();
  const [service, uploads] = await Promise.all([
    supabase.from("services").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("uploads")
      .select("id", { count: "exact", head: true })
      .eq("service_id", id),
  ]);
  if (!service.data) notFound();
  const hasUploads = (uploads.count ?? 0) > 0;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href={`/services/${id}`} className="text-body-sm text-muted underline">
          {service.data.name}
        </Link>
        <h1 className="text-display text-ink">Edit service</h1>
      </div>

      <Card className="flex flex-col gap-3">
        <EditServiceForm
          serviceId={id}
          name={service.data.name}
          date={churchIsoDate(service.data.starts_at)}
          time={churchClockTime(service.data.starts_at)}
        />
        <p className="text-body-sm text-muted">
          Changing the date moves each team&apos;s delivery deadline with it.
        </p>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-title text-ink">Delete this service</h2>
        {hasUploads ? (
          <p className="text-body-sm text-muted">
            This service has uploads, so it cannot be deleted. That protects
            the record of who uploaded what.
          </p>
        ) : (
          <>
            <p className="text-body-sm text-muted">
              Removes the service, its assignments and handoffs, and moves its
              empty Google Drive folder to the Drive bin.
            </p>
            <ActionButton
              action={deleteService}
              fields={{ service_id: id }}
              label="Delete service"
              pendingLabel="Deleting…"
              variant="danger"
              size="md"
              className="self-start"
              confirmMessage={`Delete ${service.data.name}? This cannot be undone here.`}
            />
          </>
        )}
      </Card>
    </div>
  );
}
