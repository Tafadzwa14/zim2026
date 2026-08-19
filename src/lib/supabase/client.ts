"use client";

import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

/**
 * Browser Supabase client (anon key). Reads are limited by RLS to the
 * public, non-sensitive tables; all writes go through server actions.
 * Mainly used for Realtime subscriptions.
 */
export function createClient() {
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
}
