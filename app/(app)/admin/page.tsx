import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Admin" };

const SECTIONS = [
  {
    href: "/admin/people",
    title: "People",
    body: "Invite people, change roles, turn access on or off.",
  },
  {
    href: "/admin/teams",
    title: "Teams",
    body: "Receiving teams such as Thumbnails, and who is on them.",
  },
  {
    href: "/admin/categories",
    title: "Categories",
    body: "The folders every service gets, such as Baptism and Preacher.",
  },
  {
    href: "/admin/google",
    title: "Google Drive",
    body: "The church Google account where photos and videos are stored.",
  },
  {
    href: "/admin/telegram",
    title: "Telegram",
    body: "The bot that posts reminders and handoffs in the team group.",
  },
];

export default async function AdminPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-display text-ink">Admin</h1>
      <ul className="grid gap-4 tablet:grid-cols-2">
        {SECTIONS.map((section) => (
          <li key={section.href}>
            <Link
              href={section.href}
              className="flex h-full flex-col gap-1 rounded-md border border-hairline p-4 active:bg-surface-soft tablet:p-6"
            >
              <span className="text-title text-ink">{section.title}</span>
              <span className="text-body-sm text-muted">{section.body}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
