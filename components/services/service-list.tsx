import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { formatChurchDate, formatChurchTime } from "@/lib/domain/time";
import type { Service } from "@/lib/supabase/database.types";

export function ServiceList({ services }: { services: Service[] }) {
  return (
    <ul className="grid gap-3 tablet:grid-cols-2 desktop:grid-cols-3">
      {services.map((service) => (
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
            {service.drive_folder_status === "failed" ? (
              <Badge tone="danger" className="self-start">
                Folders not created
              </Badge>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}
