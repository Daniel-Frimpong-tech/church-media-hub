/**
 * Working out what is still missing for a service. Used by the dashboard and,
 * from phase 6, by the Telegram reminders, so both always agree on who is
 * chased for what.
 */

/** One category one person was asked to cover at one service. */
export type Task = {
  assignmentId: string;
  serviceId: string;
  profileId: string;
  categoryId: string;
  /** When they marked it done, if they have. */
  doneAt: string | null;
};

/** A finished upload. */
export type UploadRecord = {
  serviceId: string;
  categoryId: string;
  uploadedBy: string | null;
};

const key = (serviceId: string, categoryId: string, profileId: string) =>
  `${serviceId}:${categoryId}:${profileId}`;

/**
 * Tasks that still need chasing: not marked done, and that person has not
 * uploaded anything to that category for that service.
 *
 * Someone who uploaded but forgot to tap "done" is not chased; someone who
 * tapped "done" without uploading (they handed files over another way) is not
 * chased either.
 */
export function outstandingTasks(tasks: Task[], uploads: UploadRecord[]): Task[] {
  const uploaded = new Set(
    uploads
      .filter((upload) => upload.uploadedBy !== null)
      .map((upload) =>
        key(upload.serviceId, upload.categoryId, upload.uploadedBy as string),
      ),
  );
  return tasks.filter(
    (task) =>
      task.doneAt === null &&
      !uploaded.has(key(task.serviceId, task.categoryId, task.profileId)),
  );
}

export type PersonOutstanding = {
  profileId: string;
  /** Categories still owed, without duplicates, in the order first seen. */
  categoryIds: string[];
};

/** Groups outstanding tasks so each person appears once, with all they owe. */
export function outstandingByPerson(outstanding: Task[]): PersonOutstanding[] {
  const byPerson = new Map<string, string[]>();
  for (const task of outstanding) {
    const categories = byPerson.get(task.profileId) ?? [];
    if (!categories.includes(task.categoryId)) categories.push(task.categoryId);
    byPerson.set(task.profileId, categories);
  }
  return [...byPerson].map(([profileId, categoryIds]) => ({
    profileId,
    categoryIds,
  }));
}
