import type { Metadata } from "next";
import { ScheduleView } from "@/components/admin/schedule-view";
import { requireAdmin } from "@/lib/auth";
import { describeRecurrence } from "@/lib/domain/recurrence";
import { currentTime, formatChurchDateTime } from "@/lib/domain/time";
import type { JobResult } from "@/lib/jobs/run";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Schedule" };

// The Supabase scheduler runs every 15 minutes. Two hours of silence means it
// has stopped and only the once-a-day backup is running.
const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

function isJobResult(value: unknown): value is JobResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "servicesCreated" in value &&
    "failed" in value &&
    Array.isArray(value.failed)
  );
}

export default async function SchedulePage() {
  await requireAdmin();
  const supabase = await createClient();

  const [series, settings] = await Promise.all([
    supabase.from("service_series").select("*").order("weekday").order("local_time"),
    createAdminClient()
      .from("app_settings")
      .select("last_job_run_at, last_job_result")
      .maybeSingle(),
  ]);
  if (series.error) {
    throw new Error(`Could not load the schedule: ${series.error.message}`);
  }

  const lastRunAt = settings.data?.last_job_run_at ?? null;

  return (
    <ScheduleView
      data={{
        series: series.data.map((item) => ({
          id: item.id,
          name: item.name,
          weekday: item.weekday,
          // "Every Sunday at 10:00 AM" → "10:00 AM"
          timeLabel: describeRecurrence({
            weekday: item.weekday,
            localTime: item.local_time,
          }).split(" at ")[1],
          active: item.active,
        })),
        jobs: {
          lastRanLabel: lastRunAt ? formatChurchDateTime(lastRunAt) : null,
          stale:
            lastRunAt === null ||
            currentTime().getTime() - new Date(lastRunAt).getTime() > STALE_AFTER_MS,
          lastResult: isJobResult(settings.data?.last_job_result)
            ? settings.data.last_job_result
            : null,
        },
      }}
    />
  );
}
