import { describe, expect, it } from "vitest";
import { resolveAppUrl } from "@/lib/env";

const LIVE = "church-media-hub-khaki.vercel.app";

describe("resolveAppUrl", () => {
  it("uses the configured address locally", () => {
    expect(
      resolveAppUrl({
        configured: "http://localhost:3000",
        vercelEnv: undefined,
        vercelProductionHost: undefined,
      }),
    ).toBe("http://localhost:3000");
  });

  it("uses the live address on Vercel when the variable was left as localhost", () => {
    expect(
      resolveAppUrl({
        configured: "http://localhost:3000",
        vercelEnv: "production",
        vercelProductionHost: LIVE,
      }),
    ).toBe(`https://${LIVE}`);
  });

  it("uses the live address on Vercel when the variable is missing", () => {
    expect(
      resolveAppUrl({ configured: undefined, vercelEnv: "production", vercelProductionHost: LIVE }),
    ).toBe(`https://${LIVE}`);
  });

  it("lets a real configured address override, for a custom domain", () => {
    expect(
      resolveAppUrl({
        configured: "https://media.rcw.example/",
        vercelEnv: "production",
        vercelProductionHost: LIVE,
      }),
    ).toBe("https://media.rcw.example");
  });

  it("does not use the live address for preview deployments", () => {
    expect(
      resolveAppUrl({
        configured: "https://preview.example",
        vercelEnv: "preview",
        vercelProductionHost: LIVE,
      }),
    ).toBe("https://preview.example");
  });

  it("fails clearly when nothing is configured anywhere", () => {
    expect(() =>
      resolveAppUrl({ configured: "", vercelEnv: undefined, vercelProductionHost: undefined }),
    ).toThrow(/NEXT_PUBLIC_APP_URL/);
  });
});
