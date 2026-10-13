"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Select } from "@/components/ui/select";
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/domain/roles";
import type { Role } from "@/lib/domain/permissions";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { revokeInvite, updatePerson } from "./actions";

/** Inside a person's panel: change their role, or turn their access on or off. */
export function PersonManageForm({
  personId,
  personName,
  role,
  active,
}: {
  personId: string;
  personName: string;
  role: Role;
  active: boolean;
}) {
  const [state, action, pending] = useActionState(updatePerson, EMPTY_FORM_STATE);

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="id" value={personId} />

      <section className="flex flex-col gap-3">
        <Select label="Role" name="role" defaultValue={role}>
          {ROLES.map((option) => (
            <option key={option} value={option}>
              {ROLE_LABELS[option]}: {ROLE_DESCRIPTIONS[option]}
            </option>
          ))}
        </Select>
        <Button
          type="submit"
          name="intent"
          value="set_role"
          variant="secondary"
          disabled={pending}
          className="self-start"
        >
          Save role
        </Button>
      </section>

      <FormMessage state={state} />

      <section className="flex flex-col gap-2 border-t border-hairline pt-4">
        <h3 className="text-label text-muted uppercase">Access</h3>
        <p className="text-caption text-muted">
          {active
            ? `Turning access off signs ${personName} out of everything. Their uploads stay, with their name on them.`
            : `${personName} cannot sign in. Turn access back on to let them in again.`}
        </p>
        <Button
          type="submit"
          name="intent"
          value={active ? "deactivate" : "reactivate"}
          variant={active ? "danger" : "secondary"}
          size="sm"
          disabled={pending}
          className="self-start"
        >
          {active ? "Turn off access" : "Turn on access"}
        </Button>
      </section>
    </form>
  );
}

/** Cancels an invite that has not been used yet. */
export function CancelInviteButton({ email }: { email: string }) {
  const [state, action, pending] = useActionState(revokeInvite, EMPTY_FORM_STATE);

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="email" value={email} />
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        disabled={pending}
        aria-label={`Cancel the invite for ${email}`}
      >
        Cancel
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
