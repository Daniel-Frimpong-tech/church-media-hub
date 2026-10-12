/** What a server action reports back to the form that called it. */
export type FormState = { error?: string; success?: string };

export const EMPTY_FORM_STATE: FormState = {};
