// @vitest-environment node
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/google/crypto";

const key = randomBytes(32).toString("base64");
const otherKey = randomBytes(32).toString("base64");
const token = "1//0gExampleRefreshToken-abc_DEF";

describe("encryptSecret / decryptSecret", () => {
  it("round-trips a value", () => {
    expect(decryptSecret(encryptSecret(token, key), key)).toBe(token);
  });

  it("does not contain the original value", () => {
    expect(encryptSecret(token, key)).not.toContain(token);
  });

  it("produces different output each time, so equal tokens do not look equal", () => {
    expect(encryptSecret(token, key)).not.toBe(encryptSecret(token, key));
  });

  it("refuses to decrypt with the wrong key", () => {
    expect(() => decryptSecret(encryptSecret(token, key), otherKey)).toThrow();
  });

  it("refuses data that has been tampered with", () => {
    const parts = encryptSecret(token, key).split(".");
    const body = Buffer.from(parts[3], "base64url");
    body[0] ^= 1;
    parts[3] = body.toString("base64url");
    expect(() => decryptSecret(parts.join("."), key)).toThrow();
  });

  it("rejects a key of the wrong length", () => {
    const shortKey = randomBytes(16).toString("base64");
    expect(() => encryptSecret(token, shortKey)).toThrow(/32 bytes/);
  });

  it("rejects values in an unknown format", () => {
    expect(() => decryptSecret("not-encrypted", key)).toThrow(/format/);
  });
});
