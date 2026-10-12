/**
 * Handoff deadline rules. Pure functions with no database or clock access, so
 * the dashboard, the reminder job and the tests all agree on what "late" means.
 */

export type HandoffStatus = "pending" | "delivered" | "late";

export type HandoffTiming = {
  /** When the receiving team should have the content by. */
  dueAt: Date;
  /** When the receiving team marked it received, if they have. */
  receivedAt: Date | null;
};

const MS_PER_HOUR = 60 * 60 * 1000;

/** A handoff is due a fixed number of hours after the service starts. */
export function handoffDueAt(serviceStartsAt: Date, deadlineHours: number): Date {
  if (!Number.isFinite(deadlineHours) || deadlineHours < 0) {
    throw new RangeError("deadlineHours must be zero or a positive number");
  }
  return new Date(serviceStartsAt.getTime() + deadlineHours * MS_PER_HOUR);
}

/**
 * Once a team has marked a handoff received it is `delivered`, even if that
 * happened after the deadline (see `wasDeliveredLate`). Until then it is
 * `pending`, turning `late` the moment the deadline passes.
 */
export function handoffStatus(timing: HandoffTiming, now: Date): HandoffStatus {
  if (timing.receivedAt) return "delivered";
  return now.getTime() > timing.dueAt.getTime() ? "late" : "pending";
}

export function wasDeliveredLate(timing: HandoffTiming): boolean {
  return (
    timing.receivedAt !== null &&
    timing.receivedAt.getTime() > timing.dueAt.getTime()
  );
}

/**
 * What to show for a handoff. Adds "ready" to the three stored-fact statuses:
 * the content is there, and the team has not confirmed it yet.
 */
export type HandoffStage = "waiting" | "ready" | "delivered" | "late";

export type HandoffProgress = HandoffTiming & {
  /** When the content became ready for the team, if it has. */
  readyAt: Date | null;
};

export function handoffStage(progress: HandoffProgress, now: Date): HandoffStage {
  const status = handoffStatus(progress, now);
  if (status === "delivered") return "delivered";
  // Overdue and unconfirmed is late whether or not the content is ready: the
  // deadline is about the team having it.
  if (status === "late") return "late";
  return progress.readyAt ? "ready" : "waiting";
}

/** True when the deadline is close enough to be worth flagging. */
export function isDueSoon(
  timing: HandoffTiming,
  now: Date,
  withinHours: number = 6,
): boolean {
  if (timing.receivedAt) return false;
  const remaining = timing.dueAt.getTime() - now.getTime();
  return remaining > 0 && remaining <= withinHours * MS_PER_HOUR;
}
