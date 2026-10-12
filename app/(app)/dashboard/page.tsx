import type { Metadata } from "next";
import Link from "next/link";
import { ServiceList } from "@/components/services/service-list";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { can } from "@/lib/domain/permissions";
import { ROLE_LABELS } from "@/lib/domain/roles";
import { upcomingCutoff } from "@/lib/domain/time";
import { getGoogleConnectionSummary } from "@/lib/google/connection";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const profile = await requireProfile();
  const firstName = profile.full_name.split(" ")[0];
  const canManage = can(profile.role, "manage_services");

  const supabase = await createClient();
  const [upcoming, connection] = await Promise.all([
    supabase
      .from("services")
      .select("*")
      .gte("starts_at", upcomingCutoff())
      .order("starts_at")
      .limit(6),
    canManage ? getGoogleConnectionSummary() : null,
  ]);
  if (upcoming.error) {
    throw new Error(`Could not load services: ${upcoming.error.message}`);
  }

  const googleProblem =
    canManage && (!connection || connection.status === "expired");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-display text-ink">Hello, {firstName}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{ROLE_LABELS[profile.role]}</Badge>
          <span className="text-body-sm break-all text-muted">
            {profile.email}
          </span>
        </div>
      </div>

      {googleProblem ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-md bg-danger-soft p-4"
        >
          <div className="flex flex-col gap-1">
            <p className="text-title text-danger">
              {connection
                ? "The church Google account needs reconnecting"
                : "Connect the church Google account"}
            </p>
            <p className="text-body-sm text-ink-soft">
              {connection
                ? "Google stopped accepting the saved sign-in. New folders and uploads will fail until it is reconnected."
                : "Services cannot get Drive folders until the church account is connected."}
            </p>
          </div>
          <Link
            href="/admin/google"
            className={buttonClasses("primary", "md", "self-start")}
          >
            {connection ? "Reconnect Google" : "Connect Google"}
          </Link>
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-title-lg text-ink">Upcoming services</h2>
          <Link href="/services" className="text-body-sm text-primary underline">
            All services
          </Link>
        </div>
        {upcoming.data.length === 0 ? (
          <Card className="flex flex-col items-start gap-3">
            <p className="text-body-sm text-muted">
              {canManage
                ? "No upcoming services. Create the next one to set up its folders."
                : "No upcoming services yet."}
            </p>
            {canManage ? (
              <Link href="/services/new" className={buttonClasses("secondary")}>
                New service
              </Link>
            ) : null}
          </Card>
        ) : (
          <ServiceList services={upcoming.data} />
        )}
      </section>
    </div>
  );
}
