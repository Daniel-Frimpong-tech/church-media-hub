import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./invite-form";
import { InviteRow } from "./invite-row";
import { PersonRow } from "./person-row";

export const metadata: Metadata = { title: "People" };

export default async function PeoplePage() {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const [people, invites, teams, memberships] = await Promise.all([
    supabase.from("profiles").select("*").order("full_name"),
    supabase
      .from("invites")
      .select("*")
      .is("accepted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("teams").select("*").order("name"),
    supabase.from("team_members").select("*"),
  ]);

  const failed = people.error ?? invites.error ?? teams.error ?? memberships.error;
  if (failed) throw new Error(`Could not load people: ${failed.message}`);

  const teamNameById = new Map(
    (teams.data ?? []).map((team) => [team.id, team.name]),
  );
  const teamNamesByPerson = new Map<string, string[]>();
  for (const membership of memberships.data ?? []) {
    const name = teamNameById.get(membership.team_id);
    if (!name) continue;
    const names = teamNamesByPerson.get(membership.profile_id) ?? [];
    names.push(name);
    teamNamesByPerson.set(membership.profile_id, names);
  }

  const pending = invites.data ?? [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-display text-ink">People</h1>
        <p className="text-body text-ink-soft">
          Only people you invite here can sign in.
        </p>
      </div>

      <Card className="flex flex-col gap-4">
        <h2 className="text-title-lg text-ink">Invite someone</h2>
        <InviteForm teams={teams.data ?? []} />
      </Card>

      {pending.length > 0 ? (
        <section className="flex flex-col">
          <h2 className="text-title-lg text-ink">
            Waiting to sign in ({pending.length})
          </h2>
          <ul className="divide-y divide-hairline-soft">
            {pending.map((invite) => (
              <InviteRow
                key={invite.email}
                invite={invite}
                teamName={
                  invite.team_id
                    ? (teamNameById.get(invite.team_id) ?? null)
                    : null
                }
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col">
        <h2 className="text-title-lg text-ink">
          Has access ({people.data?.length ?? 0})
        </h2>
        <ul className="divide-y divide-hairline-soft">
          {(people.data ?? []).map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              teamNames={teamNamesByPerson.get(person.id) ?? []}
              isSelf={person.id === admin.id}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
