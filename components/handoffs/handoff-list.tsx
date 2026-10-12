import Link from "next/link";
import { setHandoffReceived } from "@/app/(app)/services/actions";
import { ActionButton } from "@/components/ui/action-button";
import { Badge } from "@/components/ui/badge";
import type { HandoffStage } from "@/lib/domain/deadlines";
import { formatChurchDate, formatChurchDateTime } from "@/lib/domain/time";
import type { HandoffRow } from "@/lib/handoffs";

const STAGE_BADGE: Record<
  HandoffStage,
  { label: string; tone: "neutral" | "accent" | "success" | "danger" }
> = {
  waiting: { label: "Pending", tone: "neutral" },
  ready: { label: "Ready to collect", tone: "accent" },
  delivered: { label: "Delivered", tone: "success" },
  late: { label: "Late", tone: "danger" },
};

export function HandoffList({
  handoffs,
  showService = true,
  isAdmin = false,
}: {
  handoffs: HandoffRow[];
  /** Hide the service line when the list is already on that service's page. */
  showService?: boolean;
  isAdmin?: boolean;
}) {
  return (
    <ul className="divide-y divide-hairline-soft">
      {handoffs.map((handoff) => {
        const badge = STAGE_BADGE[handoff.stage];
        return (
          <li
            key={handoff.id}
            className="flex flex-wrap items-center justify-between gap-3 py-3"
          >
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/services/${handoff.serviceId}/${handoff.categorySlug}`}
                  className="text-body-sm font-bold text-ink underline-offset-4 hover:underline"
                >
                  {handoff.categoryName}
                </Link>
                <span className="text-body-sm text-ink-soft">
                  for {handoff.teamName}
                </span>
                <Badge tone={badge.tone}>{badge.label}</Badge>
                {handoff.deliveredLate ? (
                  <Badge tone="warning">After deadline</Badge>
                ) : null}
              </div>
              <span className="text-caption text-muted">
                {showService
                  ? `${handoff.serviceName}, ${formatChurchDate(handoff.serviceStartsAt)} · `
                  : ""}
                {handoff.receivedAt
                  ? `Received ${formatChurchDateTime(handoff.receivedAt)}`
                  : `Due ${formatChurchDateTime(handoff.dueAt)}`}
              </span>
            </div>

            {handoff.stage !== "delivered" && handoff.canConfirm ? (
              <ActionButton
                action={setHandoffReceived}
                fields={{
                  handoff_id: handoff.id,
                  received: "true",
                  service_id: handoff.serviceId,
                }}
                label="Mark received"
                pendingLabel="Saving…"
                variant="primary"
                ariaLabel={`Mark ${handoff.categoryName} for ${handoff.teamName} received`}
              />
            ) : null}
            {handoff.stage === "delivered" && isAdmin ? (
              <ActionButton
                action={setHandoffReceived}
                fields={{
                  handoff_id: handoff.id,
                  received: "false",
                  service_id: handoff.serviceId,
                }}
                label="Undo"
                variant="ghost"
                ariaLabel={`Undo received for ${handoff.categoryName} for ${handoff.teamName}`}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
