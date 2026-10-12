import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { handoffStage, wasDeliveredLate, type HandoffStage } from "@/lib/domain/deadlines";
import { canMarkHandoffReceived, type Role } from "@/lib/domain/permissions";
import type { Database, Handoff } from "@/lib/supabase/database.types";

export type HandoffRow = {
  id: string;
  serviceId: string;
  serviceName: string;
  serviceStartsAt: string;
  categoryName: string;
  categorySlug: string;
  teamName: string;
  dueAt: string;
  stage: HandoffStage;
  deliveredLate: boolean;
  receivedAt: string | null;
  /** Whether the person viewing may confirm this handoff. */
  canConfirm: boolean;
};

const STAGE_ORDER: Record<HandoffStage, number> = {
  late: 0,
  ready: 1,
  waiting: 2,
  delivered: 3,
};

/**
 * Adds names and a status to raw handoff rows. Row Level Security has already
 * limited `handoffs` to the ones this person may see.
 */
export async function describeHandoffs(
  supabase: SupabaseClient<Database>,
  handoffs: Handoff[],
  viewer: { id: string; role: Role },
  now: Date,
): Promise<HandoffRow[]> {
  if (handoffs.length === 0) return [];

  const ids = <K extends "service_id" | "category_id" | "team_id">(column: K) => [
    ...new Set(handoffs.map((handoff) => handoff[column])),
  ];
  const [services, categories, teams, memberships] = await Promise.all([
    supabase.from("services").select("id, name, starts_at").in("id", ids("service_id")),
    supabase.from("categories").select("id, name, slug").in("id", ids("category_id")),
    supabase.from("teams").select("id, name").in("id", ids("team_id")),
    supabase.from("team_members").select("team_id").eq("profile_id", viewer.id),
  ]);
  const serviceById = new Map((services.data ?? []).map((row) => [row.id, row]));
  const categoryById = new Map((categories.data ?? []).map((row) => [row.id, row]));
  const teamById = new Map((teams.data ?? []).map((row) => [row.id, row]));
  const teamIds = (memberships.data ?? []).map((row) => row.team_id);

  const rows: HandoffRow[] = [];
  for (const handoff of handoffs) {
    const service = serviceById.get(handoff.service_id);
    const category = categoryById.get(handoff.category_id);
    const team = teamById.get(handoff.team_id);
    if (!service || !category || !team) continue;

    const timing = {
      dueAt: new Date(handoff.due_at),
      readyAt: handoff.ready_at ? new Date(handoff.ready_at) : null,
      receivedAt: handoff.received_at ? new Date(handoff.received_at) : null,
    };
    rows.push({
      id: handoff.id,
      serviceId: service.id,
      serviceName: service.name,
      serviceStartsAt: service.starts_at,
      categoryName: category.name,
      categorySlug: category.slug,
      teamName: team.name,
      dueAt: handoff.due_at,
      stage: handoffStage(timing, now),
      deliveredLate: wasDeliveredLate(timing),
      receivedAt: handoff.received_at,
      canConfirm: canMarkHandoffReceived({ role: viewer.role, teamIds }, handoff.team_id),
    });
  }

  // Most urgent first, then by deadline.
  return rows.sort(
    (a, b) =>
      STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage] || a.dueAt.localeCompare(b.dueAt),
  );
}
