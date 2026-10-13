import type { Metadata } from "next";
import { TeamsView } from "@/components/admin/teams-view";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Teams" };

export default async function TeamsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [teams, people, memberships, mappings, categories] = await Promise.all([
    supabase.from("teams").select("*").order("name"),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("active", true)
      .order("full_name"),
    supabase.from("team_members").select("*"),
    supabase.from("category_teams").select("category_id, team_id"),
    supabase.from("categories").select("id, name").eq("is_active", true).order("sort_order"),
  ]);
  const failed = teams.error ?? people.error ?? memberships.error;
  if (failed) throw new Error(`Could not load teams: ${failed.message}`);

  const activePeople = (people.data ?? []).map((person) => ({
    id: person.id,
    name: person.full_name,
  }));
  const memberIds = new Map<string, Set<string>>();
  for (const membership of memberships.data ?? []) {
    const ids = memberIds.get(membership.team_id) ?? new Set<string>();
    ids.add(membership.profile_id);
    memberIds.set(membership.team_id, ids);
  }

  return (
    <TeamsView
      data={{
        teams: (teams.data ?? []).map((team) => {
          const ids = memberIds.get(team.id) ?? new Set<string>();
          const received = new Set(
            (mappings.data ?? [])
              .filter((mapping) => mapping.team_id === team.id)
              .map((mapping) => mapping.category_id),
          );
          return {
            id: team.id,
            name: team.name,
            kind: team.kind,
            members: activePeople.filter((person) => ids.has(person.id)),
            candidates: activePeople.filter((person) => !ids.has(person.id)),
            receives: (categories.data ?? [])
              .filter((category) => received.has(category.id))
              .map((category) => category.name),
          };
        }),
      }}
    />
  );
}
