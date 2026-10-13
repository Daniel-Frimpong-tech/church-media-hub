"use client";

import { useActionState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Select } from "@/components/ui/select";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { manageTeam } from "./actions";

type Person = { id: string; name: string };

/** Inside a team's panel: its members, adding one, and deleting the team. */
export function TeamManageForm({
  teamId,
  teamName,
  members,
  candidates,
}: {
  teamId: string;
  teamName: string;
  members: Person[];
  /** Active people who are not on this team yet. */
  candidates: Person[];
}) {
  const [state, action, pending] = useActionState(manageTeam, EMPTY_FORM_STATE);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="team_id" value={teamId} />

      <section className="flex flex-col gap-2">
        <h3 className="text-label text-muted uppercase">Members</h3>
        {members.length === 0 ? (
          <p className="text-body-sm text-muted">Nobody is on this team yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex items-center justify-between gap-3 rounded-md bg-surface-soft p-2 pl-3"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Avatar name={member.name} size="sm" />
                  <span className="truncate text-body-sm text-ink">{member.name}</span>
                </span>
                <Button
                  type="submit"
                  name="intent"
                  value={`remove_member:${member.id}`}
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  aria-label={`Remove ${member.name} from ${teamName}`}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        )}
        {candidates.length > 0 ? (
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Select
                label={`Add a person to ${teamName}`}
                hideLabel
                name="profile_id"
                defaultValue=""
              >
                <option value="">Add a person…</option>
                {candidates.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </Select>
            </div>
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
      </section>

      <section className="flex flex-col gap-2 border-t border-hairline pt-4">
        <h3 className="text-label text-muted uppercase">Delete</h3>
        <p className="text-caption text-muted">
          Members keep their accounts. They stop seeing the categories this
          team received.
        </p>
        <Button
          type="submit"
          name="intent"
          value="delete_team"
          variant="danger"
          size="sm"
          disabled={pending}
          className="self-start"
          onClick={(event) => {
            if (!window.confirm(`Delete ${teamName}? Its members keep their accounts.`)) {
              event.preventDefault();
            }
          }}
        >
          Delete this team
        </Button>
      </section>
    </form>
  );
}
