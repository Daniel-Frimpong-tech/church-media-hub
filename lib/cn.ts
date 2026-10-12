type ClassValue = string | false | null | undefined;

/** Joins class names, skipping falsy values so conditionals stay readable. */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
