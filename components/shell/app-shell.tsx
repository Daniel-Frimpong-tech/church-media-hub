"use client";

import { LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import type { Role } from "@/lib/domain/permissions";
import { ROLE_LABELS } from "@/lib/domain/roles";
import { adminNavFor, isActive, MAIN_NAV, type NavLink } from "@/lib/nav";
import { NavIcon } from "./nav-icon";

export type ShellUser = { name: string; email: string; role: Role };

/**
 * The frame around every signed-in page.
 *
 * Desktop: a sidebar with every section one click away.
 * Phone: a slim top bar and a thumb-reach tab bar; "More" opens the rest.
 */
export function AppShell({
  user,
  children,
  currentPath,
}: {
  user: ShellUser;
  children: ReactNode;
  /** Overrides the real path. Used by preview pages. */
  currentPath?: string;
}) {
  const realPath = usePathname();
  const pathname = currentPath ?? realPath;
  const adminNav = adminNavFor(user.role);

  return (
    <div className="flex min-h-dvh flex-1">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-6 overflow-y-auto border-r border-hairline-soft bg-canvas p-4 desktop:flex">
        <Brand />
        <nav aria-label="Main" className="flex flex-col gap-1">
          {MAIN_NAV.map((link) => (
            <SidebarLink key={link.href} link={link} active={isActive(pathname, link.href)} />
          ))}
        </nav>
        {adminNav.length > 0 ? (
          <nav aria-label="Admin" className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-label text-muted-soft uppercase">Admin</p>
            {adminNav.map((link) => (
              <SidebarLink key={link.href} link={link} active={isActive(pathname, link.href)} />
            ))}
          </nav>
        ) : null}
        <div className="mt-auto flex flex-col gap-2">
          <UserChip user={user} />
          <SignOutButton className="justify-start px-3" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-hairline-soft bg-canvas/85 px-4 backdrop-blur desktop:hidden">
          <Brand />
          <Avatar name={user.name} />
        </header>

        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 pt-5 pb-28 tablet:px-8 tablet:pt-8 desktop:pb-12">
          {children}
        </main>

        <MobileTabs pathname={pathname} adminNav={adminNav} user={user} />
      </div>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-2 px-1 text-title text-ink">
      <span
        aria-hidden
        className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-body-sm font-extrabold text-on-primary"
      >
        R
      </span>
      RCW Media
    </Link>
  );
}

function SidebarLink({ link, active }: { link: NavLink; active: boolean }) {
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-10 items-center gap-3 rounded-md px-3 text-body-sm transition-colors",
        active
          ? "bg-surface-strong font-bold text-ink"
          : "text-muted hover:bg-surface hover:text-ink",
      )}
    >
      <NavIcon name={link.icon} size={18} className={active ? "text-primary" : undefined} />
      {link.label}
    </Link>
  );
}

function UserChip({ user }: { user: ShellUser }) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-surface p-3">
      <Avatar name={user.name} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-body-sm font-bold text-ink">{user.name}</span>
        <span className="truncate text-caption text-muted">{ROLE_LABELS[user.role]}</span>
      </div>
    </div>
  );
}

function SignOutButton({ className }: { className?: string }) {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className={cn(
          "flex h-10 w-full items-center gap-3 rounded-md text-body-sm text-muted transition-colors hover:bg-surface hover:text-ink",
          className,
        )}
      >
        <LogOut aria-hidden size={18} />
        Sign out
      </button>
    </form>
  );
}

function MobileTabs({
  pathname,
  adminNav,
  user,
}: {
  pathname: string;
  adminNav: NavLink[];
  user: ShellUser;
}) {
  const [open, setOpen] = useState(false);
  const sheet = useRef<HTMLDialogElement>(null);
  const moreActive = adminNav.some((link) => isActive(pathname, link.href));

  useEffect(() => {
    const dialog = sheet.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-hairline-soft bg-canvas/90 pb-[env(safe-area-inset-bottom)] backdrop-blur desktop:hidden"
      >
        <ul className="flex">
          {MAIN_NAV.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <li key={link.href} className="flex-1">
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[0.6875rem] font-bold transition-colors",
                    active ? "text-ink" : "text-muted-soft",
                  )}
                >
                  <NavIcon
                    name={link.icon}
                    size={22}
                    className={cn("transition-transform", active && "scale-110 text-primary")}
                  />
                  {link.label}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-haspopup="dialog"
              className={cn(
                "flex h-16 w-full flex-col items-center justify-center gap-1 text-[0.6875rem] font-bold",
                moreActive ? "text-ink" : "text-muted-soft",
              )}
            >
              <Menu aria-hidden size={22} className={moreActive ? "text-primary" : undefined} />
              More
            </button>
          </li>
        </ul>
      </nav>

      {/* Bottom sheet with everything that does not fit in the tab bar. */}
      <dialog
        ref={sheet}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          // A tap on the backdrop (the dialog element itself) closes it.
          if (event.target === event.currentTarget) setOpen(false);
        }}
        aria-label="More"
        className="m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-xl border-0 bg-surface p-0 text-ink backdrop:bg-black/60 desktop:hidden"
      >
        <div className="flex flex-col gap-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between">
            <UserChip user={user} />
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-strong"
            >
              <X aria-hidden size={18} />
            </button>
          </div>
          {adminNav.length > 0 ? (
            <nav aria-label="Admin" className="flex flex-col gap-1">
              <p className="px-3 pb-1 text-label text-muted-soft uppercase">Admin</p>
              <ul className="grid grid-cols-2 gap-2">
                {adminNav.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex h-12 items-center gap-3 rounded-md bg-surface-soft px-3 text-body-sm font-bold",
                        isActive(pathname, link.href) ? "text-primary" : "text-ink",
                      )}
                    >
                      <NavIcon name={link.icon} size={18} />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
          <SignOutButton className="justify-center bg-surface-soft" />
        </div>
      </dialog>
    </>
  );
}
