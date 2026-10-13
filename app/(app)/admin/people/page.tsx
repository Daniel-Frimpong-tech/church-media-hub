import type { Metadata } from "next";
import { PeopleView } from "@/components/admin/people-view";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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

  const teamName = new Map((teams.data ?? []).map((team) => [team.id, team.name]));
  const teamsByPerson = new Map<string, string[]>();
  for (const membership of memberships.data ?? []) {
    const name = teamName.get(membership.team_id);
    if (!name) continue;
    const names = teamsByPerson.get(membership.profile_id) ?? [];
    names.push(name);
    teamsByPerson.set(membership.profile_id, names);
  }

  return (
    <PeopleView
      data={{
        teams: teams.data ?? [],
        invites: (invites.data ?? []).map((invite) => ({
          email: invite.email,
          role: invite.role,
          teamName: invite.team_id ? (teamName.get(invite.team_id) ?? null) : null,
        })),
        people: (people.data ?? []).map((person) => ({
          id: person.id,
          name: person.full_name,
          email: person.email,
          role: person.role,
          active: person.active,
          isSelf: person.id === admin.id,
          teams: teamsByPerson.get(person.id) ?? [],
          telegramLinked: person.telegram_user_id !== null,
        })),
      }}
    />
  );
}
