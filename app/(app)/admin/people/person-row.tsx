"use client";

import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Select } from "@/components/ui/select";
import { ROLES, ROLE_LABELS } from "@/lib/domain/roles";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import type { Profile } from "@/lib/supabase/database.types";
import { updatePerson } from "./actions";

export function PersonRow({
  person,
  teamNames,
  isSelf,
}: {
  person: Profile;
  teamNames: string[];
  isSelf: boolean;
}) {
  const [state, action, pending] = useActionState(
    updatePerson,
    EMPTY_FORM_STATE,
  );

  return (
    <li className="flex flex-col gap-3 py-4">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-title text-ink">{person.full_name}</span>
          {isSelf ? <Badge>You</Badge> : null}
          {!person.active ? <Badge tone="danger">Access off</Badge> : null}
        </div>
        <span className="text-body-sm break-all text-muted">{person.email}</span>
        {teamNames.length > 0 ? (
          <span className="text-caption text-muted">{teamNames.join(", ")}</span>
        ) : null}
      </div>

      {isSelf ? (
        <p className="text-body-sm text-muted">
          {ROLE_LABELS[person.role]}. Another admin has to change your access.
        </p>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="id" value={person.id} />
          <div className="flex flex-wrap items-end gap-2">
            <Select
              label={`Role for ${person.full_name}`}
              hideLabel
              name="role"
              defaultValue={person.role}
              className="min-w-36"
            >
              {ROLES.map((role) => (
                <option key={role} value={role}>
                  {ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
            <Button
              type="submit"
              name="intent"
              value="set_role"
              variant="secondary"
              disabled={pending}
            >
              Save role
            </Button>
            <Button
              type="submit"
              name="intent"
              value={person.active ? "deactivate" : "reactivate"}
              variant={person.active ? "danger" : "secondary"}
              disabled={pending}
            >
              {person.active ? "Turn off access" : "Turn on access"}
            </Button>
          </div>
          <FormMessage state={state} />
        </form>
      )}
    </li>
  );
}
