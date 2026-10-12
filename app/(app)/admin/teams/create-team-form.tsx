"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { createTeam } from "./actions";

export function CreateTeamForm() {
  const [state, action, pending] = useActionState(createTeam, EMPTY_FORM_STATE);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid gap-4 tablet:grid-cols-2">
        <Input
          label="Team name"
          name="name"
          placeholder="Thumbnails"
          maxLength={60}
          required
        />
        <Select label="Kind" name="kind" defaultValue="receiving">
          <option value="receiving">Receiving: gets content from media</option>
          <option value="media">Media: captures and uploads</option>
        </Select>
      </div>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="tablet:self-start">
        {pending ? "Creating…" : "Create team"}
      </Button>
    </form>
  );
}
