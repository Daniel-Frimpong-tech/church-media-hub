"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Select } from "@/components/ui/select";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { addCategoryTeam, updateCategoryTeam } from "./actions";

const hoursInput =
  "h-12 w-20 rounded-sm border border-border-strong bg-canvas px-3 text-body text-ink";

/** One team that receives a category: change its deadline or remove it. */
export function DeliveryRow({
  categoryId,
  categoryName,
  teamId,
  teamName,
  deadlineHours,
}: {
  categoryId: string;
  categoryName: string;
  teamId: string;
  teamName: string;
  deadlineHours: number;
}) {
  const [state, action, pending] = useActionState(
    updateCategoryTeam,
    EMPTY_FORM_STATE,
  );
  const hoursId = `hours-${categoryId}-${teamId}`;

  return (
    <li className="flex flex-col gap-1 py-2">
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="category_id" value={categoryId} />
        <input type="hidden" name="team_id" value={teamId} />
        <span className="min-w-28 text-body-sm font-medium text-ink">{teamName}</span>
        <label htmlFor={hoursId} className="text-body-sm text-muted">
          within
        </label>
        <input
          id={hoursId}
          name="deadline_hours"
          type="number"
          inputMode="numeric"
          min={0}
          max={720}
          defaultValue={deadlineHours}
          aria-label={`Hours ${teamName} has to receive ${categoryName}`}
          className={hoursInput}
        />
        <span className="text-body-sm text-muted">hours</span>
        <Button type="submit" name="intent" value="save" variant="secondary" size="sm" disabled={pending}>
          Save
        </Button>
        <Button
          type="submit"
          name="intent"
          value="remove"
          variant="ghost"
          size="sm"
          disabled={pending}
          aria-label={`Stop delivering ${categoryName} to ${teamName}`}
        >
          Remove
        </Button>
      </form>
      <FormMessage state={state} />
    </li>
  );
}

/** Start delivering a category to another team. */
export function AddDeliveryForm({
  categoryId,
  categoryName,
  teams,
}: {
  categoryId: string;
  categoryName: string;
  teams: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(addCategoryTeam, EMPTY_FORM_STATE);

  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="category_id" value={categoryId} />
      <div className="flex flex-wrap items-end gap-2">
        <Select
          label={`Team to receive ${categoryName}`}
          hideLabel
          name="team_id"
          defaultValue=""
          className="min-w-40"
        >
          <option value="">Add a team…</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </Select>
        <input
          name="deadline_hours"
          type="number"
          inputMode="numeric"
          min={0}
          max={720}
          defaultValue={24}
          aria-label={`Hours the team has to receive ${categoryName}`}
          className={hoursInput}
        />
        <span className="pb-3 text-body-sm text-muted">hours</span>
        <Button type="submit" variant="secondary" disabled={pending}>
          Add
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
