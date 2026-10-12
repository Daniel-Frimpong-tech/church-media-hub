import type { Metadata } from "next";
import Link from "next/link";
import { HandoffList } from "@/components/handoffs/handoff-list";
import {
  ServiceList,
  type ServiceCoverage,
} from "@/components/services/service-list";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { loadAssignments, loadUploadRecords } from "@/lib/assignments";
import { requireProfile } from "@/lib/auth";
import { outstandingTasks } from "@/lib/domain/assignments";
import { can } from "@/lib/domain/permissions";
import { ROLE_LABELS } from "@/lib/domain/roles";
import {
  currentTime,
  formatChurchDate,
  recentCutoff,
  upcomingCutoff,
} from "@/lib/domain/time";
import { getGoogleConnectionSummary } from "@/lib/google/connection";
import { describeHandoffs } from "@/lib/handoffs";
import { setTaskDone } from "../services/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const profile = await requireProfile();
  const firstName = profile.full_name.split(" ")[0];
  const canManage = can(profile.role, "manage_services");

  const supabase = await createClient();
  // "Current" services: the last two weeks and everything upcoming. Tasks and
  // handoffs for these are what people still act on.
  const [current, connection] = await Promise.all([
    supabase
      .from("services")
      .select("*")
      .gte("starts_at", recentCutoff())
      .order("starts_at")
      .limit(40),
    canManage ? getGoogleConnectionSummary() : null,
  ]);
  if (current.error) {
    throw new Error(`Could not load services: ${current.error.message}`);
  }
  const services = current.data;
  const serviceIds = services.map((service) => service.id);
  const serviceById = new Map(services.map((service) => [service.id, service]));
  const upcomingFrom = upcomingCutoff();
  const upcoming = services
    .filter((service) => service.starts_at >= upcomingFrom)
    .slice(0, 6);

  const [assignments, uploadRecords, people, categories, handoffRows] =
    await Promise.all([
      loadAssignments(supabase, serviceIds),
      loadUploadRecords(supabase, serviceIds),
      supabase.from("profiles").select("id, full_name"),
      supabase.from("categories").select("id, name"),
      serviceIds.length > 0
        ? supabase.from("handoffs").select("*").in("service_id", serviceIds)
        : null,
    ]);
  const personName = new Map(
    (people.data ?? []).map((person) => [person.id, person.full_name]),
  );
  const categoryName = new Map(
    (categories.data ?? []).map((category) => [category.id, category.name]),
  );

  const allTasks = assignments.flatMap((assignment) => assignment.tasks);
  const outstanding = outstandingTasks(allTasks, uploadRecords);

  // Who is covering each service and how much is still missing.
  const coverage = new Map<string, ServiceCoverage>();
  for (const assignment of assignments) {
    const entry = coverage.get(assignment.serviceId) ?? { assigned: [], missing: 0 };
    const name = personName.get(assignment.profileId)?.split(" ")[0] ?? "Someone";
    if (!entry.assigned.includes(name)) entry.assigned.push(name);
    coverage.set(assignment.serviceId, entry);
  }
  for (const task of outstanding) {
    const entry = coverage.get(task.serviceId);
    if (entry) entry.missing += 1;
  }

  // This person's own tasks that are not marked done yet.
  const outstandingKeys = new Set(
    outstanding.map((task) => `${task.assignmentId}:${task.categoryId}`),
  );
  const myTasks = allTasks
    .filter((task) => task.profileId === profile.id && task.doneAt === null)
    .sort((a, b) =>
      (serviceById.get(a.serviceId)?.starts_at ?? "").localeCompare(
        serviceById.get(b.serviceId)?.starts_at ?? "",
      ),
    );

  const openHandoffs = (
    await describeHandoffs(supabase, handoffRows?.data ?? [], profile, currentTime())
  ).filter((handoff) => handoff.stage !== "delivered");
  const lateCount = openHandoffs.filter((handoff) => handoff.stage === "late").length;

  // A viewer with no team can see nothing, which otherwise looks like a bug.
  const viewerWithoutTeam =
    profile.role === "viewer" &&
    ((
      await supabase
        .from("team_members")
        .select("team_id", { count: "exact", head: true })
        .eq("profile_id", profile.id)
    ).count ?? 0) === 0;

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

      {viewerWithoutTeam ? (
        <div role="status" className="flex flex-col gap-1 rounded-md bg-warning-soft p-4">
          <p className="text-title text-warning">You are not on a team yet</p>
          <p className="text-body-sm text-ink-soft">
            You will see photos, videos and handoffs once an admin adds you to
            your team. Ask a media team admin to do that.
          </p>
        </div>
      ) : null}

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

      {myTasks.length > 0 ? (
        <Card className="flex flex-col gap-2">
          <h2 className="text-title-lg text-ink">Your tasks</h2>
          <ul className="divide-y divide-hairline-soft">
            {myTasks.map((task) => {
              const service = serviceById.get(task.serviceId);
              const nothingUploaded = outstandingKeys.has(
                `${task.assignmentId}:${task.categoryId}`,
              );
              return (
                <li
                  key={`${task.assignmentId}:${task.categoryId}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="flex min-w-0 flex-col gap-1">
                    <Link
                      href={`/services/${task.serviceId}`}
                      className="text-body font-medium text-primary underline"
                    >
                      Upload {categoryName.get(task.categoryId) ?? "category"}
                    </Link>
                    <span className="text-caption text-muted">
                      {service
                        ? `${service.name}, ${formatChurchDate(service.starts_at)}`
                        : ""}
                    </span>
                    {nothingUploaded ? null : (
                      <Badge className="self-start">
                        Uploaded. Mark done when finished
                      </Badge>
                    )}
                  </div>
                  <ActionButton
                    action={setTaskDone}
                    fields={{
                      assignment_id: task.assignmentId,
                      category_id: task.categoryId,
                      service_id: task.serviceId,
                      done: "true",
                    }}
                    label="Mark done"
                    ariaLabel={`Mark done: ${categoryName.get(task.categoryId) ?? "category"} for ${service?.name ?? "service"}`}
                  />
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {openHandoffs.length > 0 ? (
        <Card className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-title-lg text-ink">
                {profile.role === "viewer" ? "For your team" : "Handoffs"}
              </h2>
              {lateCount > 0 ? <Badge tone="danger">{lateCount} late</Badge> : null}
            </div>
            <Link href="/handoffs" className="text-body-sm text-primary underline">
              All handoffs
            </Link>
          </div>
          <HandoffList
            handoffs={openHandoffs.slice(0, 8)}
            isAdmin={profile.role === "admin"}
          />
          {openHandoffs.length > 8 ? (
            <p className="text-body-sm text-muted">
              And {openHandoffs.length - 8} more.
            </p>
          ) : null}
        </Card>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-title-lg text-ink">Upcoming services</h2>
          <Link href="/services" className="text-body-sm text-primary underline">
            All services
          </Link>
        </div>
        {upcoming.length === 0 ? (
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
          <ServiceList services={upcoming} coverage={coverage} />
        )}
      </section>
    </div>
  );
}
