import { describe, expect, it } from "vitest";
import {
  can,
  canMarkHandoffReceived,
  canViewCategory,
  type Action,
  type Role,
} from "@/lib/domain/permissions";

const THUMBNAILS = "team-thumbnails";
const SOCIAL = "team-social";

describe("can", () => {
  const adminOnly: Action[] = [
    "manage_people",
    "manage_teams",
    "manage_categories",
    "manage_services",
    "manage_assignments",
  ];

  it.each(adminOnly)("lets only admins %s", (action) => {
    expect(can("admin", action)).toBe(true);
    expect(can("member", action)).toBe(false);
    expect(can("viewer", action)).toBe(false);
  });

  it("lets admins and members upload and complete tasks, but not viewers", () => {
    for (const action of ["upload_media", "complete_tasks"] as const) {
      expect(can("admin", action)).toBe(true);
      expect(can("member", action)).toBe(true);
      expect(can("viewer", action)).toBe(false);
    }
  });

});

describe("canViewCategory", () => {
  it.each<Role>(["admin", "member"])(
    "lets a %s see a category even with no team",
    (role) => {
      expect(canViewCategory({ role, teamIds: [] }, [THUMBNAILS])).toBe(true);
    },
  );

  it("lets a viewer see a category delivered to their team", () => {
    const viewer = { role: "viewer" as const, teamIds: [THUMBNAILS] };
    expect(canViewCategory(viewer, [SOCIAL, THUMBNAILS])).toBe(true);
  });

  it("hides a category delivered only to other teams", () => {
    const viewer = { role: "viewer" as const, teamIds: [THUMBNAILS] };
    expect(canViewCategory(viewer, [SOCIAL])).toBe(false);
  });

  it("hides everything from a viewer who is on no team", () => {
    const viewer = { role: "viewer" as const, teamIds: [] };
    expect(canViewCategory(viewer, [THUMBNAILS])).toBe(false);
  });

  it("hides a category that is not delivered to any team", () => {
    const viewer = { role: "viewer" as const, teamIds: [THUMBNAILS] };
    expect(canViewCategory(viewer, [])).toBe(false);
  });
});

describe("canMarkHandoffReceived", () => {
  it("lets a viewer confirm a handoff to their own team", () => {
    const viewer = { role: "viewer" as const, teamIds: [THUMBNAILS] };
    expect(canMarkHandoffReceived(viewer, THUMBNAILS)).toBe(true);
  });

  it("stops a viewer confirming another team's handoff", () => {
    const viewer = { role: "viewer" as const, teamIds: [THUMBNAILS] };
    expect(canMarkHandoffReceived(viewer, SOCIAL)).toBe(false);
  });

  it("lets an admin confirm any handoff", () => {
    const admin = { role: "admin" as const, teamIds: [] };
    expect(canMarkHandoffReceived(admin, SOCIAL)).toBe(true);
  });

  it("stops a member who is not on the team", () => {
    const member = { role: "member" as const, teamIds: [] };
    expect(canMarkHandoffReceived(member, THUMBNAILS)).toBe(false);
  });

  it("lets a member who is also on the receiving team confirm", () => {
    const member = { role: "member" as const, teamIds: [THUMBNAILS] };
    expect(canMarkHandoffReceived(member, THUMBNAILS)).toBe(true);
  });
});
