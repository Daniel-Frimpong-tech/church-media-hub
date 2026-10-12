import type { Metadata } from "next";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { describeRecurrence } from "@/lib/domain/recurrence";
import { currentTime, formatChurchDateTime } from "@/lib/domain/time";
import type { JobResult } from "@/lib/jobs/run";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { runJobsNow, updateSeries } from "./actions";
import { SeriesForm } from "./series-form";

export const metadata: Metadata = { title: "Schedule" };

// The Supabase scheduler runs every 15 minutes. Two hours of silence means it
// has stopped and only the once-a-day backup is running.
const STALE_AFTER_MS = 2 * 60 * 60 * 1000;

function summarize(result: JobResult): string[] {
  const lines: string[] = [];
  const count = (n: number, one: string, many: string) =>
    `${n} ${n === 1 ? one : many}`;
  if (result.servicesCreated > 0) {
    lines.push(`Created ${count(result.servicesCreated, "service", "services")}.`);
  }
  if (result.foldersFixed > 0) {
    lines.push(`Created Drive folders for ${count(result.foldersFixed, "service", "services")} that had failed.`);
  }
  const messages = result.reminders + result.readyNotices + result.lateNotices;
  if (messages > 0) {
    lines.push(
      `Posted ${count(messages, "Telegram message", "Telegram messages")} (${result.reminders} reminders, ${result.readyNotices} ready, ${result.lateNotices} late).`,
    );
  }
  if (!result.telegramLinked) {
    lines.push("Telegram is not linked, so nothing was posted.");
  }
  if (result.driveAccessRemoved > 0) {
    lines.push(`Finished removing Drive access for ${count(result.driveAccessRemoved, "folder", "folders")}.`);
  }
  if (result.uploadsClosed > 0) {
    lines.push(`Closed ${count(result.uploadsClosed, "abandoned upload", "abandoned uploads")}.`);
  }
  if (lines.length === 0 || (lines.length === 1 && !result.telegramLinked)) {
    lines.push("Nothing was due.");
  }
  return lines;
}

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
  const lastResult = isJobResult(settings.data?.last_job_result)
    ? settings.data.last_job_result
    : null;
  const stale =
    lastRunAt === null ||
    currentTime().getTime() - new Date(lastRunAt).getTime() > STALE_AFTER_MS;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-display text-ink">Schedule</h1>
        <p className="text-body text-ink-soft">
          Services that repeat every week are created for you a week ahead,
          with their Drive folders.
        </p>
      </div>

      <Card className="flex flex-col gap-3">
        <h2 className="text-title-lg text-ink">Recurring services</h2>
        {series.data.length === 0 ? (
          <p className="text-body-sm text-muted">
            None yet. Add your regular Sunday service below.
          </p>
        ) : (
          <ul className="divide-y divide-hairline-soft">
            {series.data.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-title text-ink">{item.name}</span>
                    {item.active ? null : <Badge>Paused</Badge>}
                  </div>
                  <span className="text-body-sm text-muted">
                    {describeRecurrence({
                      weekday: item.weekday,
                      localTime: item.local_time,
                    })}{" "}
                    Pacific
                  </span>
                </div>
                <div className="flex gap-2">
                  <ActionButton
                    action={updateSeries}
                    fields={{
                      series_id: item.id,
                      intent: item.active ? "pause" : "resume",
                    }}
                    label={item.active ? "Pause" : "Resume"}
                    ariaLabel={`${item.active ? "Pause" : "Resume"} ${item.name}`}
                  />
                  <ActionButton
                    action={updateSeries}
                    fields={{ series_id: item.id, intent: "delete" }}
                    label="Delete"
                    variant="ghost"
                    ariaLabel={`Delete recurring ${item.name}`}
                    confirmMessage={`Stop creating ${item.name} every week? Services already created are kept.`}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
        <details className="rounded-sm border border-hairline p-4">
          <summary className="cursor-pointer text-body-sm font-medium text-ink">
            Add a recurring service
          </summary>
          <div className="pt-4">
            <SeriesForm />
          </div>
        </details>
        <p className="text-body-sm text-muted">
          Deleting a single service that was created this way does not bring it
          back the next week it runs: only that one occurrence is skipped.
        </p>
      </Card>

      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-title-lg text-ink">Automatic jobs</h2>
          {stale ? (
            <Badge tone="danger">Not running regularly</Badge>
          ) : (
            <Badge tone="success">Running</Badge>
          )}
        </div>
        <p className="text-body-sm text-muted">
          Every 15 minutes the app creates recurring services, posts upload
          reminders and handoff alerts that are due, and tidies up.
        </p>
        <p className="text-body-sm text-ink-soft">
          {lastRunAt
            ? `Last ran ${formatChurchDateTime(lastRunAt)} Pacific.`
            : "Has never run."}
        </p>
        {stale ? (
          <p role="alert" className="rounded-sm bg-danger-soft p-3 text-body-sm text-danger">
            {lastRunAt
              ? "It has not run in the last two hours. The 15-minute scheduler in Supabase may have stopped. A once-a-day backup still runs, but reminders will be late."
              : "The scheduler has not been set up yet. Follow docs/SCHEDULER.md, or tap “Run now” to run the jobs once."}
          </p>
        ) : null}
        {lastResult ? (
          <ul className="list-disc space-y-1 pl-5 text-body-sm text-ink-soft">
            {summarize(lastResult).map((line) => (
              <li key={line}>{line}</li>
            ))}
            {lastResult.failed.length > 0 ? (
              <li className="text-danger">
                Failed: {lastResult.failed.join(", ")}.
              </li>
            ) : null}
          </ul>
        ) : null}
        <ActionButton
          action={runJobsNow}
          fields={{}}
          label="Run now"
          pendingLabel="Running…"
          size="md"
          className="self-start"
        />
      </Card>
    </div>
  );
}
