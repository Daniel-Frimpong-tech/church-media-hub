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
