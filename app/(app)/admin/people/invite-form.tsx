"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Role } from "@/lib/domain/permissions";
import { isRole, ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/domain/roles";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import type { Team } from "@/lib/supabase/database.types";
import { invitePerson } from "./actions";

export function InviteForm({ teams }: { teams: Team[] }) {
  const [state, action, pending] = useActionState(
    invitePerson,
    EMPTY_FORM_STATE,
  );

  const [role, setRole] = useState<Role>("member");
  const isViewer = role === "viewer";

  return (
    <form action={action} className="flex flex-col gap-4">
      <Input
        label="Google email address"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="off"
        autoCapitalize="none"
        placeholder="name@gmail.com"
        required
      />
      <div className="grid gap-4 tablet:grid-cols-2">
        <Select
          label="Role"
          name="role"
          value={role}
          onChange={(event) => {
            if (isRole(event.target.value)) setRole(event.target.value);
          }}
        >
          {ROLES.map((option) => (
            <option key={option} value={option}>
              {ROLE_LABELS[option]}: {ROLE_DESCRIPTIONS[option]}
            </option>
          ))}
        </Select>
        <Select
          label={isViewer ? "Team" : "Team (optional)"}
          name="team_id"
          defaultValue=""
          required={isViewer}
        >
          <option value="">{isViewer ? "Choose a team…" : "No team"}</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </Select>
      </div>
      {isViewer ? (
        <p className="text-body-sm text-muted">
          A viewer sees only the categories delivered to their team, so they
          need one.
          {teams.length === 0 ? " There are no teams yet: create one under Admin → Teams first." : ""}
        </p>
      ) : null}
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="tablet:self-start">
        {pending ? "Inviting…" : "Invite"}
      </Button>
    </form>
  );
}
