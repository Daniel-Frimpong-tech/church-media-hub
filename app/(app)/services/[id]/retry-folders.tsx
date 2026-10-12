"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { retryServiceFolders } from "../actions";

export function RetryFolders({
  serviceId,
  label,
}: {
  serviceId: string;
  label: string;
}) {
  const [state, action, pending] = useActionState(
    retryServiceFolders,
    EMPTY_FORM_STATE,
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="service_id" value={serviceId} />
      <Button
        type="submit"
        variant="secondary"
        disabled={pending}
        className="self-start"
      >
        {pending ? "Creating folders…" : label}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
