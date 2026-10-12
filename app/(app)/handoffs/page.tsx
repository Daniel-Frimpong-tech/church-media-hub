import type { Metadata } from "next";
import Link from "next/link";
import { HandoffList } from "@/components/handoffs/handoff-list";
import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { currentTime, recentCutoff } from "@/lib/domain/time";
import { describeHandoffs } from "@/lib/handoffs";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Handoffs" };

const HISTORY_LIMIT = 200;

export default async function HandoffsPage({
  searchParams,
}: PageProps<"/handoffs">) {
  const profile = await requireProfile();
  const showAll = (await searchParams).show === "all";
  const supabase = await createClient();

  // Row Level Security returns only this person's teams' handoffs, or all of
  // them for admins and members.
  let query = supabase
    .from("handoffs")
    .select("*")
    .order("due_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  if (!showAll) {
    // "Open" means not yet received, plus anything due recently so a just
    // confirmed handoff does not vanish from the list.
    query = query.or(`received_at.is.null,due_at.gte.${recentCutoff()}`);
  }
  const { data, error } = await query;
  if (error) throw new Error(`Could not load handoffs: ${error.message}`);

  const handoffs = await describeHandoffs(supabase, data, profile, currentTime());
  const open = handoffs.filter((handoff) => handoff.stage !== "delivered");
  const delivered = handoffs.filter((handoff) => handoff.stage === "delivered");
  const isAdmin = profile.role === "admin";

  const tab = (active: boolean) =>
    cn(
      "flex h-10 items-center rounded-full px-4 text-body-sm font-medium",
      active ? "bg-ink text-canvas" : "border border-hairline text-ink",
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-display text-ink">Handoffs</h1>
        <p className="text-body text-ink-soft">
          {profile.role === "viewer"
            ? "What the media team has ready for your team. Mark each one received once you have what you need."
            : "What each receiving team is waiting for, and what they have confirmed."}
        </p>
      </div>

      <div className="flex gap-2">
        <Link href="/handoffs" className={tab(!showAll)} aria-current={!showAll ? "page" : undefined}>
          Current
        </Link>
        <Link href="/handoffs?show=all" className={tab(showAll)} aria-current={showAll ? "page" : undefined}>
          All
        </Link>
      </div>

      {handoffs.length === 0 ? (
        <p className="rounded-md bg-surface-soft p-6 text-body-sm text-muted">
          {profile.role === "viewer"
            ? "Nothing for your team yet. If you expected something, ask an admin to check your team and its categories."
            : "No handoffs yet. They appear when a service is created and its categories are delivered to a team (Admin → Categories)."}
        </p>
      ) : (
        <>
          <Card className="flex flex-col gap-2">
            <h2 className="text-title-lg text-ink">Open ({open.length})</h2>
            {open.length === 0 ? (
              <p className="text-body-sm text-muted">Everything has been received.</p>
            ) : (
              <HandoffList handoffs={open} isAdmin={isAdmin} />
            )}
          </Card>
          {delivered.length > 0 ? (
            <Card className="flex flex-col gap-2">
              <h2 className="text-title-lg text-ink">Delivered ({delivered.length})</h2>
              <HandoffList handoffs={delivered} isAdmin={isAdmin} />
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
