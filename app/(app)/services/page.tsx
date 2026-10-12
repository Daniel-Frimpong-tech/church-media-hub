import type { Metadata } from "next";
import Link from "next/link";
import { ServiceList } from "@/components/services/service-list";
import { buttonClasses } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { can } from "@/lib/domain/permissions";
import { upcomingCutoff } from "@/lib/domain/time";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Services" };

const PAST_LIMIT = 30;

export default async function ServicesPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const cutoff = upcomingCutoff();

  const [upcoming, past] = await Promise.all([
    supabase
      .from("services")
      .select("*")
      .gte("starts_at", cutoff)
      .order("starts_at"),
    supabase
      .from("services")
      .select("*")
      .lt("starts_at", cutoff)
      .order("starts_at", { ascending: false })
      .limit(PAST_LIMIT),
  ]);
  const failed = upcoming.error ?? past.error;
  if (failed) throw new Error(`Could not load services: ${failed.message}`);

  const upcomingServices = upcoming.data ?? [];
  const pastServices = past.data ?? [];
  const canManage = can(profile.role, "manage_services");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-display text-ink">Services</h1>
        {canManage ? (
          <Link href="/services/new" className={buttonClasses()}>
            New service
          </Link>
        ) : null}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-title-lg text-ink">Upcoming</h2>
        {upcomingServices.length === 0 ? (
          <p className="text-body-sm text-muted">
            {canManage
              ? "No upcoming services. Create the next one to set up its folders."
              : "No upcoming services yet."}
          </p>
        ) : (
          <ServiceList services={upcomingServices} />
        )}
      </section>

      {pastServices.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-title-lg text-ink">Past</h2>
          <ServiceList services={pastServices} />
        </section>
      ) : null}
    </div>
  );
}
