import "server-only";

import { isSupabaseConfigured } from "@/lib/env";
import { getMemoryRepo } from "./memory";
import { getSupabaseRepo } from "./supabase";
import type { Repo } from "./types";

export type * from "./types";

/**
 * The app's data source. Uses Supabase when configured (the real backend),
 * and an in-memory seeded repo otherwise so the app runs before credentials
 * are in place.
 */
export function getRepo(): Repo {
  return isSupabaseConfigured() ? getSupabaseRepo() : getMemoryRepo();
}
