"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/domain/roles";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import type { Team } from "@/lib/supabase/database.types";
import { invitePerson } from "./actions";

export function InviteForm({ teams }: { teams: Team[] }) {
  const [state, action, pending] = useActionState(
    invitePerson,
    EMPTY_FORM_STATE,
  );

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
        <Select label="Role" name="role" defaultValue="member">
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}: {ROLE_DESCRIPTIONS[role]}
            </option>
          ))}
        </Select>
        <Select label="Team (optional)" name="team_id" defaultValue="">
          <option value="">No team</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </Select>
      </div>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="tablet:self-start">
        {pending ? "Inviting…" : "Invite"}
      </Button>
    </form>
  );
}
