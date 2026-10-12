import Link from "next/link";
import { AppNav, type NavItem } from "@/components/nav/app-nav";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireProfile();

  const items: NavItem[] = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/services", label: "Services" },
  ];
  if (profile.role === "admin") {
    items.push({ href: "/admin", label: "Admin" });
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-hairline">
        <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center gap-6 px-4 tablet:px-6">
          <Link href="/dashboard" className="text-title text-ink">
            RCW Media
          </Link>
          <div className="tablet:flex-1">
            <AppNav items={items} />
          </div>
          <form action="/auth/signout" method="post" className="ml-auto">
            <Button type="submit" variant="ghost" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>
      {/* Bottom padding leaves room for the tab bar on phones. */}
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-6 pb-24 tablet:px-6 tablet:pt-8 tablet:pb-16">
        {children}
      </main>
    </div>
  );
}
