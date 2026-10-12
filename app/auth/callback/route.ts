import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Only allow redirects to paths inside this app. */
function safeNextPath(value: string | null): string {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return "/dashboard";
}

/**
 * Google sends the person back here after sign-in. We swap the one-time code
 * for a session cookie, then send them into the app.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(
        new URL(safeNextPath(searchParams.get("next")), origin),
      );
    }
    return NextResponse.redirect(new URL("/login?error=sign_in_failed", origin));
  }

  // No code means Supabase refused the sign-up. The invite gate in the
  // database is the expected reason: it reports a database error.
  const description = searchParams.get("error_description") ?? "";
  const reason = /database error/i.test(description)
    ? "not_invited"
    : "sign_in_failed";
  return NextResponse.redirect(new URL(`/login?error=${reason}`, origin));
}
