import { describe, expect, it } from "vitest";
import { isRole, normalizeEmail } from "@/lib/domain/roles";

describe("normalizeEmail", () => {
  it("trims and lowercases so invites match however they were typed", () => {
    expect(normalizeEmail("  Grace.Mensah@Gmail.com ")).toBe(
      "grace.mensah@gmail.com",
    );
  });

  it.each(["", "grace", "grace@", "@gmail.com", "grace@gmail", "a b@c.com"])(
    "rejects %j",
    (value) => {
      expect(normalizeEmail(value)).toBeNull();
    },
  );

  it("rejects values that are not text", () => {
    expect(normalizeEmail(null)).toBeNull();
  });
});

describe("isRole", () => {
  it("accepts the three roles and nothing else", () => {
    expect(isRole("admin")).toBe(true);
    expect(isRole("member")).toBe(true);
    expect(isRole("viewer")).toBe(true);
    expect(isRole("owner")).toBe(false);
    expect(isRole(null)).toBe(false);
  });
});
