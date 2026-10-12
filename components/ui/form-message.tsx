import type { FormState } from "@/lib/form-state";

/** Shows the result of a server action. Announced to screen readers. */
export function FormMessage({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-body-sm text-danger">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="text-body-sm text-success">
        {state.success}
      </p>
    );
  }
  return null;
}
