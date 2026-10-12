"use client";

import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/form-message";
import { Select } from "@/components/ui/select";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import type { Profile, Team } from "@/lib/supabase/database.types";
import { manageTeam } from "./actions";

type Person = Pick<Profile, "id" | "full_name">;

export function TeamCard({
  team,
  members,
  candidates,
}: {
  team: Team;
  members: Person[];
  /** Active people who are not on this team yet. */
  candidates: Person[];
}) {
  const [state, action, pending] = useActionState(manageTeam, EMPTY_FORM_STATE);

  return (
    <Card>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="team_id" value={team.id} />

        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-title text-ink">{team.name}</h3>
          <Badge tone={team.kind === "media" ? "accent" : "neutral"}>
            {team.kind === "media" ? "Media" : "Receiving"}
          </Badge>
        </div>

        {members.length === 0 ? (
          <p className="text-body-sm text-muted">Nobody is on this team yet.</p>
        ) : (
          <ul className="divide-y divide-hairline-soft">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-3 py-2"
              >
                <span className="text-body text-ink">{member.full_name}</span>
                <Button
                  type="submit"
                  name="intent"
                  value={`remove_member:${member.id}`}
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  aria-label={`Remove ${member.full_name} from ${team.name}`}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}

        {candidates.length > 0 ? (
          <div className="flex flex-wrap items-end gap-2">
            <Select
              label={`Add a person to ${team.name}`}
              hideLabel
              name="profile_id"
              defaultValue=""
              className="min-w-48"
            >
              <option value="">Choose a person…</option>
              {candidates.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.full_name}
                </option>
              ))}
            </Select>
            <Button
              type="submit"
              name="intent"
              value="add_member"
              variant="secondary"
              disabled={pending}
            >
              Add
            </Button>
          </div>
        ) : null}

        <FormMessage state={state} />

        <Button
          type="submit"
          name="intent"
          value="delete_team"
          variant="danger"
          size="sm"
          disabled={pending}
          className="self-start"
          onClick={(event) => {
            if (
              !window.confirm(
                `Delete ${team.name}? Its members keep their accounts.`,
              )
            ) {
              event.preventDefault();
            }
          }}
        >
          Delete team
        </Button>
      </form>
    </Card>
  );
}
