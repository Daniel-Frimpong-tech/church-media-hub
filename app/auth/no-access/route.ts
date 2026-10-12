import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Where a signed-in person lands if they have no active profile (for example
 * an admin deactivated them). Ends their session and explains why.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(
    new URL("/login?error=no_access", request.nextUrl.origin),
  );
}
