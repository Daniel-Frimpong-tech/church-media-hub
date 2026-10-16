"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Select } from "@/components/ui/select";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { addAssignment } from "../actions";

type Option = { id: string; name: string };

export function AddAssignmentForm({
  serviceId,
  people,
  dutyRoles,
  categories,
}: {
  serviceId: string;
  people: Option[];
  dutyRoles: Option[];
  categories: Option[];
}) {
  const [state, action, pending] = useActionState(addAssignment, EMPTY_FORM_STATE);

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="service_id" value={serviceId} />
      <div className="grid gap-4 tablet:grid-cols-2">
        <Select label="Person" name="profile_id" defaultValue="" required>
          <option value="" disabled>
            Choose a person…
          </option>
          {people.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </Select>
        <Select label="Doing" name="duty_role_id" defaultValue={dutyRoles[0]?.id ?? ""}>
          {dutyRoles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </Select>
      </div>

      <fieldset className="flex min-w-0 flex-col gap-2">
        <legend className="mb-2 text-body-sm font-medium text-ink">
          Expected to upload
        </legend>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <label
              key={category.id}
              className="flex h-11 cursor-pointer items-center gap-2 rounded-full border border-hairline px-4 text-body-sm font-medium text-ink has-checked:border-ink has-checked:bg-ink has-checked:text-canvas has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary"
            >
              <input
                type="checkbox"
                name="category_ids"
                value={category.id}
                className="sr-only"
              />
              {category.name}
            </label>
          ))}
        </div>
      </fieldset>

      <FormMessage state={state} />
      <Button type="submit" variant="secondary" disabled={pending} className="tablet:self-start">
        {pending ? "Assigning…" : "Assign"}
      </Button>
    </form>
  );
}
