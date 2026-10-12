"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export type NavItem = { href: string; label: string };

/**
 * Bottom tab bar on phones, where thumbs reach; inline links in the top bar
 * from tablet width up.
 */
export function AppNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-hairline bg-canvas pb-[env(safe-area-inset-bottom)] tablet:static tablet:border-0 tablet:pb-0"
    >
      <ul className="flex tablet:gap-2">
        {items.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1 tablet:flex-none">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-14 items-center justify-center px-4 text-body-sm font-medium tablet:h-10 tablet:rounded-full",
                  active
                    ? "text-primary tablet:bg-primary-soft"
                    : "text-muted active:bg-surface-strong",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
