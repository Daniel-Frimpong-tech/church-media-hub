import "server-only";

import { createClient } from "@supabase/supabase-js";
import { supabaseSecretKey, supabaseUrl } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Supabase client that uses the secret key and BYPASSES Row Level Security.
 * Use it only for data no signed-in user may touch directly (the Google
 * connection), and only after the caller's permission has been checked.
 */
export function createAdminClient() {
  return createClient<Database>(supabaseUrl(), supabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
