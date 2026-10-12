/**
 * Who may do what. The database enforces these rules with Row Level Security;
 * this module mirrors them so the UI can hide what a person cannot use and
 * server actions can fail early with a clear message.
 */

export type Role = "admin" | "member" | "viewer";

export type Action =
  | "manage_people"
  | "manage_teams"
  | "manage_categories"
  | "manage_services"
  | "manage_assignments"
  | "upload_media"
  | "complete_tasks"
  | "view_all_media"
  | "mark_handoff_received";

const ALLOWED: Record<Action, readonly Role[]> = {
  manage_people: ["admin"],
  manage_teams: ["admin"],
  manage_categories: ["admin"],
  manage_services: ["admin"],
  manage_assignments: ["admin"],
  upload_media: ["admin", "member"],
  complete_tasks: ["admin", "member"],
  view_all_media: ["admin", "member"],
  // Whether someone may confirm a particular handoff also depends on their
  // team: see canMarkHandoffReceived.
  mark_handoff_received: ["admin", "member", "viewer"],
};

export function can(role: Role, action: Action): boolean {
  return ALLOWED[action].includes(role);
}

export type Viewer = {
  role: Role;
  /** Teams this person belongs to. */
  teamIds: readonly string[];
};

/**
 * Admins and members see every category. A viewer sees a category only if it
 * is delivered to at least one of their teams.
 */
export function canViewCategory(
  viewer: Viewer,
  categoryTeamIds: readonly string[],
): boolean {
  if (can(viewer.role, "view_all_media")) return true;
  return categoryTeamIds.some((teamId) => viewer.teamIds.includes(teamId));
}

/**
 * Anyone on the receiving team may confirm that team's handoff. Admins may
 * confirm any handoff. The database function set_handoff_received enforces
 * the same rule.
 */
export function canMarkHandoffReceived(
  viewer: Viewer,
  handoffTeamId: string,
): boolean {
  return viewer.role === "admin" || viewer.teamIds.includes(handoffTeamId);
}
