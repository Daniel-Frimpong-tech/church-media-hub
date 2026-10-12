import { describe, expect, it } from "vitest";
import {
  outstandingByPerson,
  outstandingTasks,
  type Task,
} from "@/lib/domain/assignments";

const task = (overrides: Partial<Task>): Task => ({
  assignmentId: "assignment-1",
  serviceId: "sunday",
  profileId: "grace",
  categoryId: "preacher",
  doneAt: null,
  ...overrides,
});

describe("outstandingTasks", () => {
  it("includes a task that is not done and has no upload", () => {
    expect(outstandingTasks([task({})], [])).toHaveLength(1);
  });

  it("leaves out a task marked done", () => {
    expect(outstandingTasks([task({ doneAt: "2025-10-12T20:00:00Z" })], [])).toEqual([]);
  });

  it("leaves out someone who uploaded but forgot to mark it done", () => {
    const uploads = [{ serviceId: "sunday", categoryId: "preacher", uploadedBy: "grace" }];
    expect(outstandingTasks([task({})], uploads)).toEqual([]);
  });

  it("still chases Grace when only Sam uploaded to that category", () => {
    const tasks = [task({}), task({ assignmentId: "assignment-2", profileId: "sam" })];
    const uploads = [{ serviceId: "sunday", categoryId: "preacher", uploadedBy: "sam" }];
    expect(outstandingTasks(tasks, uploads).map((t) => t.profileId)).toEqual(["grace"]);
  });

  it("does not count an upload to a different category or service", () => {
    const uploads = [
      { serviceId: "sunday", categoryId: "baptism", uploadedBy: "grace" },
      { serviceId: "midweek", categoryId: "preacher", uploadedBy: "grace" },
    ];
    expect(outstandingTasks([task({})], uploads)).toHaveLength(1);
  });

  it("ignores uploads whose uploader has since been removed", () => {
    const uploads = [{ serviceId: "sunday", categoryId: "preacher", uploadedBy: null }];
    expect(outstandingTasks([task({})], uploads)).toHaveLength(1);
  });
});

describe("outstandingByPerson", () => {
  it("lists each person once with everything they owe", () => {
    const outstanding = [
      task({ categoryId: "preacher" }),
      task({ categoryId: "baptism" }),
      task({ profileId: "sam", categoryId: "videos" }),
    ];
    expect(outstandingByPerson(outstanding)).toEqual([
      { profileId: "grace", categoryIds: ["preacher", "baptism"] },
      { profileId: "sam", categoryIds: ["videos"] },
    ]);
  });

  it("does not repeat a category someone holds under two roles", () => {
    const outstanding = [
      task({ assignmentId: "as-photographer" }),
      task({ assignmentId: "as-editor" }),
    ];
    expect(outstandingByPerson(outstanding)).toEqual([
      { profileId: "grace", categoryIds: ["preacher"] },
    ]);
  });

  it("returns nothing when nothing is outstanding", () => {
    expect(outstandingByPerson([])).toEqual([]);
  });
});
