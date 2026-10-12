"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { Input } from "@/components/ui/input";
import { EMPTY_FORM_STATE } from "@/lib/form-state";
import { deleteService } from "../../actions";

/**
 * Deleting a service that has uploads removes those too, so the admin has to
 * type the service's name. An empty service needs only a confirmation.
 */
export function DeleteServiceForm({
  serviceId,
  serviceName,
  uploadCount,
}: {
  serviceId: string;
  serviceName: string;
  uploadCount: number;
}) {
  const [state, action, pending] = useActionState(deleteService, EMPTY_FORM_STATE);
  const [typed, setTyped] = useState("");
  const needsName = uploadCount > 0;
  const ready = !needsName || typed === serviceName;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="service_id" value={serviceId} />
      {needsName ? (
        <Input
          label={`Type “${serviceName}” to confirm`}
          name="confirm_name"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          autoComplete="off"
          autoCapitalize="none"
        />
      ) : null}
      <FormMessage state={state} />
      <Button
        type="submit"
        variant="danger"
        disabled={pending || !ready}
        className="self-start"
        onClick={(event) => {
          if (
            !needsName &&
            !window.confirm(`Delete ${serviceName}? This cannot be undone here.`)
          ) {
            event.preventDefault();
          }
        }}
      >
        {pending
          ? "Deleting…"
          : needsName
            ? `Delete service and ${uploadCount} ${uploadCount === 1 ? "file" : "files"}`
            : "Delete service"}
      </Button>
    </form>
  );
}
