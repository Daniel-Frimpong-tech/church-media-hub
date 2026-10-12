import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/supabase/database.types";

/**
 * The signed-in person's profile, or null if they are signed out, were never
 * invited, or have been deactivated. Cached for the length of one request, so
 * layouts, pages and actions can all call it without repeating the query.
 */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();

  // getUser() checks the session with Supabase rather than trusting the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return profile?.active ? profile : null;
});

/** For pages and actions that need a signed-in, active person. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/auth/no-access");
  return profile;
}

/** For admin pages and actions. Row Level Security enforces the same rule. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== "admin") redirect("/dashboard");
  return profile;
}
