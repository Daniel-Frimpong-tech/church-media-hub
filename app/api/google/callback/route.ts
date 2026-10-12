import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { saveGoogleConnection } from "@/lib/google/connection";
import { exchangeCode } from "@/lib/google/oauth";

const STATE_COOKIE = "google_oauth_state";

/** Step 2: Google sends the admin back here with a one-time code. */
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  const { searchParams, origin } = request.nextUrl;

  const finish = (query: string) => {
    const response = NextResponse.redirect(
      new URL(`/admin/google?${query}`, origin),
    );
    response.cookies.delete({ name: STATE_COOKIE, path: "/api/google" });
    return response;
  };

  if (searchParams.get("error")) return finish("error=cancelled");

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get(STATE_COOKIE)?.value;
  if (!code || !state || !expectedState || state !== expectedState) {
    return finish("error=invalid_state");
  }

  try {
    const account = await exchangeCode(code, origin);
    await saveGoogleConnection(account, admin.id);
    return finish("connected=1");
  } catch (error) {
    if (error instanceof Error && error.message === "drive_permission_missing") {
      return finish("error=drive_permission_missing");
    }
    console.error("Connecting Google failed", error);
    return finish("error=failed");
  }
}
