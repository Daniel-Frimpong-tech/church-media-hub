"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { WEEKDAYS } from "@/lib/domain/recurrence";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { createSeries } from "./actions";

export function SeriesForm() {
  const [state, action, pending] = useActionState(createSeries, EMPTY_FORM_STATE);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Input
        label="Name"
        name="name"
        defaultValue="Sunday Service"
        maxLength={80}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <Select label="Every" name="weekday" defaultValue="0">
          {WEEKDAYS.map((day, index) => (
            <option key={day} value={index}>
              {day}
            </option>
          ))}
        </Select>
        <Input
          label="Time (Pacific)"
          name="time"
          type="time"
          defaultValue="10:00"
          className="h-12"
          required
        />
      </div>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} className="tablet:self-start">
        {pending ? "Adding…" : "Add recurring service"}
      </Button>
    </form>
  );
}
