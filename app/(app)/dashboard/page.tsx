import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/domain/roles";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const profile = await requireProfile();
  const firstName = profile.full_name.split(" ")[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-display text-ink">Hello, {firstName}</h1>
        <div className="flex items-center gap-2">
          <Badge tone="accent">{ROLE_LABELS[profile.role]}</Badge>
          <span className="text-body-sm text-muted">{profile.email}</span>
        </div>
      </div>
      <Card>
        <h2 className="text-title text-ink">No services yet</h2>
        <p className="mt-1 text-body-sm text-muted">
          Upcoming services, who is covering them and what is still missing
          will appear here.
        </p>
      </Card>
    </div>
  );
}
