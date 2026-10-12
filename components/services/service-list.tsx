import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatChurchDate, formatChurchTime } from "@/lib/domain/time";
import type { Service } from "@/lib/supabase/database.types";

export type ServiceCoverage = {
  /** Names of the people assigned. */
  assigned: string[];
  /** Tasks nobody has uploaded to or marked done. */
  missing: number;
};

export function ServiceList({
  services,
  coverage,
}: {
  services: Service[];
  /** When given, each card also shows who is covering it and what is missing. */
  coverage?: Map<string, ServiceCoverage>;
}) {
  return (
    <ul className="grid gap-3 tablet:grid-cols-2 desktop:grid-cols-3">
      {services.map((service) => {
        const cover = coverage?.get(service.id);
        return (
          <li key={service.id}>
            <Link
              href={`/services/${service.id}`}
              className="flex h-full flex-col gap-2 rounded-md border border-hairline p-4 active:bg-surface-soft"
            >
              <span className="text-title text-ink">{service.name}</span>
              <span className="text-body-sm text-muted">
                {formatChurchDate(service.starts_at)} ·{" "}
                {formatChurchTime(service.starts_at)}
              </span>
              {coverage ? (
                <span className="text-body-sm text-ink-soft">
                  {cover && cover.assigned.length > 0
                    ? cover.assigned.join(", ")
                    : "Nobody assigned yet"}
                </span>
              ) : null}
              <span className="flex flex-wrap gap-2">
                {cover && cover.missing > 0 ? (
                  <Badge tone="warning">
                    {cover.missing} still to upload
                  </Badge>
                ) : null}
                {service.drive_folder_status === "failed" ? (
                  <Badge tone="danger">Folders not created</Badge>
                ) : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
