import type { Role } from "@/lib/domain/permissions";

/** Names of the icons used in navigation. Mapped to components in the shell. */
export type NavIcon =
  | "home"
  | "services"
  | "gallery"
  | "handoffs"
  | "people"
  | "teams"
  | "categories"
  | "schedule"
  | "drive"
  | "telegram"
  | "share";

export type NavLink = { href: string; label: string; icon: NavIcon };

export const MAIN_NAV: NavLink[] = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/services", label: "Services", icon: "services" },
  { href: "/gallery", label: "Gallery", icon: "gallery" },
  { href: "/handoffs", label: "Handoffs", icon: "handoffs" },
];

/** Admin sections are reachable directly, not through an index page. */
export const ADMIN_NAV: NavLink[] = [
  { href: "/admin/people", label: "People", icon: "people" },
  { href: "/admin/teams", label: "Teams", icon: "teams" },
  { href: "/admin/categories", label: "Categories", icon: "categories" },
  { href: "/admin/schedule", label: "Schedule", icon: "schedule" },
  { href: "/admin/shares", label: "Shared links", icon: "share" },
  { href: "/admin/google", label: "Google Drive", icon: "drive" },
  { href: "/admin/telegram", label: "Telegram", icon: "telegram" },
];

export function adminNavFor(role: Role): NavLink[] {
  return role === "admin" ? ADMIN_NAV : [];
}

export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
