import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CreateTeamForm } from "./create-team-form";
import { TeamCard } from "./team-card";

export const metadata: Metadata = { title: "Teams" };

export default async function TeamsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [teams, people, memberships] = await Promise.all([
    supabase.from("teams").select("*").order("name"),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("active", true)
      .order("full_name"),
    supabase.from("team_members").select("*"),
  ]);

  const failed = teams.error ?? people.error ?? memberships.error;
  if (failed) throw new Error(`Could not load teams: ${failed.message}`);

  const activePeople = people.data ?? [];
  const memberIdsByTeam = new Map<string, Set<string>>();
  for (const membership of memberships.data ?? []) {
    const ids = memberIdsByTeam.get(membership.team_id) ?? new Set<string>();
    ids.add(membership.profile_id);
    memberIdsByTeam.set(membership.team_id, ids);
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-display text-ink">Teams</h1>
        <p className="text-body text-ink-soft">
          Receiving teams see only the categories delivered to them.
        </p>
      </div>

      <Card className="flex flex-col gap-4">
        <h2 className="text-title-lg text-ink">New team</h2>
        <CreateTeamForm />
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="text-title-lg text-ink">
          Teams ({teams.data?.length ?? 0})
        </h2>
        {(teams.data ?? []).length === 0 ? (
          <p className="text-body-sm text-muted">
            No teams yet. Create one above, for example Thumbnails.
          </p>
        ) : (
          <div className="grid gap-4 tablet:grid-cols-2">
            {(teams.data ?? []).map((team) => {
              const memberIds = memberIdsByTeam.get(team.id) ?? new Set();
              return (
                <TeamCard
                  key={team.id}
                  team={team}
                  members={activePeople.filter((p) => memberIds.has(p.id))}
                  candidates={activePeople.filter((p) => !memberIds.has(p.id))}
                />
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
