import { describe, expect, it } from "vitest";
import {
  describeScope,
  expiryFromChoice,
  expiryLabel,
  looksLikeToken,
  scopeKind,
  shareStatus,
  uploadInScope,
} from "@/lib/domain/share";

const now = new Date("2025-10-15T19:00:00Z");
const upload = { serviceId: "sunday", categoryId: "baptism" };

describe("shareStatus", () => {
  it("is active with no expiry", () => {
    expect(shareStatus({ expiresAt: null, revokedAt: null }, now)).toBe("active");
  });

  it("is active until the moment it expires", () => {
    expect(shareStatus({ expiresAt: "2025-10-15T19:00:01Z", revokedAt: null }, now)).toBe("active");
    expect(shareStatus({ expiresAt: "2025-10-15T19:00:00Z", revokedAt: null }, now)).toBe("expired");
  });

  it("stays turned off even if it has not expired", () => {
    expect(
      shareStatus({ expiresAt: "2026-01-01T00:00:00Z", revokedAt: "2025-10-14T00:00:00Z" }, now),
    ).toBe("revoked");
  });
});

describe("uploadInScope", () => {
  it("covers only that album for a service-and-category link", () => {
    const scope = { serviceId: "sunday", categoryId: "baptism" };
    expect(uploadInScope(upload, scope)).toBe(true);
    expect(uploadInScope({ ...upload, categoryId: "preacher" }, scope)).toBe(false);
    expect(uploadInScope({ ...upload, serviceId: "midweek" }, scope)).toBe(false);
  });

  it("covers that category in every service for a category link", () => {
    const scope = { serviceId: null, categoryId: "baptism" };
    expect(uploadInScope({ ...upload, serviceId: "midweek" }, scope)).toBe(true);
    expect(uploadInScope({ ...upload, categoryId: "preacher" }, scope)).toBe(false);
  });

  it("covers every category of one service for a service link", () => {
    const scope = { serviceId: "sunday", categoryId: null };
    expect(uploadInScope({ ...upload, categoryId: "preacher" }, scope)).toBe(true);
    expect(uploadInScope({ ...upload, serviceId: "midweek" }, scope)).toBe(false);
  });

  it("covers everything for a whole-gallery link", () => {
    expect(
      uploadInScope({ serviceId: "any", categoryId: "any" }, { serviceId: null, categoryId: null }),
    ).toBe(true);
  });
});

describe("describing a link", () => {
  const names = { category: "Baptism", service: "Sunday Service, Oct 12" };

  it.each([
    [{ serviceId: "s", categoryId: "c" }, "album", "Baptism from Sunday Service, Oct 12"],
    [{ serviceId: null, categoryId: "c" }, "category", "Every Baptism album"],
    [{ serviceId: "s", categoryId: null }, "service", "Everything from Sunday Service, Oct 12"],
    [{ serviceId: null, categoryId: null }, "everything", "The whole gallery"],
  ] as const)("%j is %s", (scope, kind, text) => {
    expect(scopeKind(scope)).toBe(kind);
    expect(describeScope(scope, names)).toBe(text);
  });
});

describe("expiryFromChoice", () => {
  it("adds the chosen number of days", () => {
    expect(expiryFromChoice("7", now)).toBe("2025-10-22T19:00:00.000Z");
    expect(expiryFromChoice("30", now)).toBe("2025-11-14T19:00:00.000Z");
  });

  it("returns null for never", () => {
    expect(expiryFromChoice("never", now)).toBeNull();
  });

  it.each(["", "1", "365", "-7", "7 days", "abc"])("rejects %j", (choice) => {
    expect(expiryFromChoice(choice, now)).toBeUndefined();
  });
});

describe("expiryLabel", () => {
  it.each([
    [{ expiresAt: null, revokedAt: null }, "Never expires"],
    [{ expiresAt: "2025-10-27T19:00:00Z", revokedAt: null }, "Expires in 12 days"],
    [{ expiresAt: "2025-10-16T03:00:00Z", revokedAt: null }, "Expires today"],
    [{ expiresAt: "2025-10-14T19:00:00Z", revokedAt: null }, "Expired"],
    [{ expiresAt: null, revokedAt: "2025-10-14T19:00:00Z" }, "Turned off"],
  ])("%j reads %s", (share, text) => {
    expect(expiryLabel(share, now)).toBe(text);
  });
});

describe("looksLikeToken", () => {
  it("accepts a 32-byte base64url token", () => {
    expect(looksLikeToken("Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6")).toBe(true);
  });

  it.each(["", "short", "has spaces in it which is not allowed at all here", "../../etc/passwd", "a".repeat(200)])(
    "rejects %j",
    (value) => {
      expect(looksLikeToken(value)).toBe(false);
    },
  );
});
