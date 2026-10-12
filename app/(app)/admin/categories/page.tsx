import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CategoryRow, CreateCategoryForm } from "./category-forms";
import { AddDeliveryForm, DeliveryRow } from "./delivery-forms";

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
  const teamNameById = new Map(allTeams.map((team) => [team.id, team.name]));
  const receivingTeams = allTeams.filter((team) => team.kind === "receiving");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-display text-ink">Categories</h1>
        <p className="text-body text-ink-soft">
          Each new service gets one Drive folder per active category. Choose
          which teams receive each category, and how long after the service
          starts they should have it.
        </p>
      </div>

      {receivingTeams.length === 0 ? (
        <p className="rounded-md bg-warning-soft p-4 text-body-sm text-warning">
          There are no receiving teams yet.{" "}
          <Link href="/admin/teams" className="underline">
            Create one
          </Link>{" "}
          (for example Thumbnails) to start delivering categories to it.
        </p>
      ) : null}

      <div className="flex flex-col gap-4">
        {(categories.data ?? []).map((category) => {
          const delivered = (mappings.data ?? []).filter(
            (mapping) => mapping.category_id === category.id,
          );
          const deliveredTeamIds = new Set(delivered.map((mapping) => mapping.team_id));
          const available = receivingTeams.filter(
            (team) => !deliveredTeamIds.has(team.id),
          );

          return (
            <Card key={category.id} className="flex flex-col gap-3">
              <ul>
                <CategoryRow category={category} />
              </ul>

              {delivered.length === 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="warning">Not delivered to any team</Badge>
                  <span className="text-body-sm text-muted">
                    Viewers cannot see this category.
                  </span>
                </div>
              ) : (
                <div>
                  <h3 className="text-body-sm font-medium text-ink">Delivered to</h3>
                  <ul className="divide-y divide-hairline-soft">
                    {delivered.map((mapping) => (
                      <DeliveryRow
                        key={mapping.team_id}
                        categoryId={category.id}
                        categoryName={category.name}
                        teamId={mapping.team_id}
                        teamName={teamNameById.get(mapping.team_id) ?? "Team"}
                        deadlineHours={mapping.deadline_hours}
                      />
                    ))}
                  </ul>
                </div>
              )}

              {category.is_active && available.length > 0 ? (
                <AddDeliveryForm
                  categoryId={category.id}
                  categoryName={category.name}
                  teams={available}
                />
              ) : null}
            </Card>
          );
        })}
      </div>

      <p className="text-body-sm text-muted">
        Retiring a category keeps its existing photos and folders. It only
        stops new services from getting that folder. Deadline changes apply to
        upcoming services and those from the last two weeks.
      </p>

      <Card className="flex flex-col gap-4">
        <h2 className="text-title-lg text-ink">Add a category</h2>
        <CreateCategoryForm />
      </Card>
    </div>
  );
}
