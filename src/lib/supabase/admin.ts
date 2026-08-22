import "server-only";

import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";

/**
 * Service-role Supabase client. Bypasses RLS, so it must ONLY ever be
 * used from trusted server code (server actions / route handlers) after
 * the caller's identity and permissions have been verified. Never expose
 * this client or its results indiscriminately to the browser.
 */
export function createAdminSupabase() {
  return createClient(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
