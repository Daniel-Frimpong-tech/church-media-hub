/** What a server action reports back to the form that called it. */
export type FormState = {
  error?: string;
  success?: string;
  /** A link the action produced, for the form to show (share links). */
  url?: string;
};

export const EMPTY_FORM_STATE: FormState = {};
