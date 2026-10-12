import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { buildGoogleAuthUrl } from "@/lib/google/oauth";

const STATE_COOKIE = "google_oauth_state";

/**
 * Step 1 of connecting the church Google account: send the admin to Google's
 * consent screen. The random `state` is remembered in a cookie and checked when
 * Google sends them back, so nobody can trick an admin into connecting an
 * account the attacker controls.
 */
export async function GET(request: NextRequest) {
  await requireAdmin();

  const state = randomBytes(32).toString("base64url");
  const response = NextResponse.redirect(
    buildGoogleAuthUrl(request.nextUrl.origin, state),
  );
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/api/google",
    maxAge: 600,
  });
  return response;
}
