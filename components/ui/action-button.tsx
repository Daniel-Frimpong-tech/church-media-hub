"use client";

import { useActionState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/form-state";

/**
 * A button that runs one server action with fixed values, and shows the
 * action's error or success message underneath.
 */
export function ActionButton({
  action,
  fields,
  label,
  pendingLabel,
  confirmMessage,
  variant = "secondary",
  size = "sm",
  className,
  ariaLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  fields: Record<string, string>;
  label: string;
  pendingLabel?: string;
  /** If set, the person must confirm before the action runs. */
  confirmMessage?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
  ariaLabel?: string;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);

  return (
    <form action={formAction} className="flex flex-col gap-1">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button
        type="submit"
        variant={variant}
        size={size}
        disabled={pending}
        className={className}
        aria-label={ariaLabel}
        onClick={(event) => {
          if (confirmMessage && !window.confirm(confirmMessage)) {
            event.preventDefault();
          }
        }}
      >
        {pending ? (pendingLabel ?? label) : label}
      </Button>
      <FormMessage state={state} />
    </form>
  );
}
