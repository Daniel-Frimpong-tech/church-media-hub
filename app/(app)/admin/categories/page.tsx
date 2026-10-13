import type { Metadata } from "next";
import { CategoriesView } from "@/components/admin/categories-view";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const [categories, teams, mappings] = await Promise.all([
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("teams").select("id, name, kind").order("name"),
    supabase.from("category_teams").select("*"),
  ]);
  const failed = categories.error ?? teams.error ?? mappings.error;
  if (failed) throw new Error(`Could not load categories: ${failed.message}`);

  const allTeams = teams.data ?? [];
  const teamName = new Map(allTeams.map((team) => [team.id, team.name]));
  const receivingTeams = allTeams.filter((team) => team.kind === "receiving");

  return (
    <CategoriesView
      data={{
        hasReceivingTeams: receivingTeams.length > 0,
        categories: (categories.data ?? []).map((category) => {
          const delivered = (mappings.data ?? []).filter(
            (mapping) => mapping.category_id === category.id,
          );
          const deliveredTo = new Set(delivered.map((mapping) => mapping.team_id));
          return {
            id: category.id,
            name: category.name,
            isActive: category.is_active,
            deliveries: delivered.map((mapping) => ({
              teamId: mapping.team_id,
              teamName: teamName.get(mapping.team_id) ?? "Team",
              deadlineHours: mapping.deadline_hours,
            })),
            availableTeams: receivingTeams
              .filter((team) => !deliveredTo.has(team.id))
              .map((team) => ({ id: team.id, name: team.name })),
          };
        }),
      }}
    />
  );
}
