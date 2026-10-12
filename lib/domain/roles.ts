import type { Role } from "./permissions";

export const ROLES: readonly Role[] = ["admin", "member", "viewer"];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Manages services, people, categories and teams",
  member: "Media team: uploads and marks tasks done",
  viewer: "Receiving team: sees only their team's categories",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Trims and lowercases an email, or returns null if it is not one. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return EMAIL_PATTERN.test(email) ? email : null;
}
