import { AppShell } from "@/components/shell/app-shell";
import { requireProfile } from "@/lib/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireProfile();

  return (
    <AppShell
      user={{ name: profile.full_name, email: profile.email, role: profile.role }}
    >
      {children}
    </AppShell>
  );
}
