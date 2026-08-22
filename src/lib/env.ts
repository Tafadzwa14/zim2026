// Client-safe environment access. Server secrets live in `server-env.ts`, which
// is protected by `server-only` and cannot accidentally enter a browser bundle.

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};

/** True once the client-facing Supabase values are present. */
export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}
