"use client";

import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { ROLE_LABELS } from "@/lib/domain/roles";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import type { Invite } from "@/lib/supabase/database.types";
import { revokeInvite } from "./actions";

export function InviteRow({
  invite,
  teamName,
}: {
  invite: Invite;
  teamName: string | null;
}) {
  const [state, action, pending] = useActionState(
    revokeInvite,
    EMPTY_FORM_STATE,
  );

  return (
    <li className="flex flex-col gap-2 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-body break-all text-ink">{invite.email}</span>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{ROLE_LABELS[invite.role]}</Badge>
            {teamName ? <Badge>{teamName}</Badge> : null}
            <Badge tone="warning">Not signed in yet</Badge>
          </div>
        </div>
        <form action={action}>
          <input type="hidden" name="email" value={invite.email} />
          <Button type="submit" variant="danger" size="sm" disabled={pending}>
            Cancel invite
          </Button>
        </form>
      </div>
      <FormMessage state={state} />
    </li>
  );
}
