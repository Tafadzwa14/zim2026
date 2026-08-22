// Central environment access. Public values are safe in the browser;
// everything else is server-only and must never be imported into a client component.

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};

/** True once the client-facing Supabase values are present. */
export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}

/**
 * Server-only secrets. Import from server components, route handlers or
 * server actions only. Throws if read without being configured.
 */
export const serverEnv = {
  get supabaseServiceRoleKey(): string {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get flightProvider(): string {
    return process.env.FLIGHT_PROVIDER ?? "mock";
  },
  get aerodataboxKey(): string {
    return process.env.AERODATABOX_API_KEY ?? "";
  },
  get aerodataboxHost(): string {
    return process.env.AERODATABOX_RAPIDAPI_HOST ?? "aerodatabox.p.rapidapi.com";
  },
  /** Live-position source, independent of the status provider. "opensky" or "none". */
  get positionProvider(): string {
    return process.env.FLIGHT_POSITION_PROVIDER ?? "opensky";
  },
  /** OpenSky OAuth2 client credentials (optional; anonymous access otherwise). */
  get openskyClientId(): string {
    return process.env.OPENSKY_CLIENT_ID ?? "";
  },
  get openskyClientSecret(): string {
    return process.env.OPENSKY_CLIENT_SECRET ?? "";
  },
  /** Extra secret mixed into PIN hashes on top of the per-user salt. */
  get pinPepper(): string {
    return process.env.APP_PIN_PEPPER ?? "";
  },
  /** One-time token that lets the first person claim admin during setup. */
  get adminSetupToken(): string {
    return process.env.ADMIN_SETUP_TOKEN ?? "";
  },
  /** OpenAI, used to read flight details out of an uploaded itinerary PDF. */
  get openaiApiKey(): string {
    return process.env.OPENAI_API_KEY ?? "";
  },
  get openaiModel(): string {
    return process.env.OPENAI_MODEL ?? "gpt-5.6-luna";
  },
  /** Itinerary reader: "local", "local-with-ai-fallback", or "openai". */
  get itineraryParser(): string {
    return (process.env.ITINERARY_PARSER ?? "local").toLowerCase();
  },
};

/**
 * True when itinerary PDF upload is available. The local parser needs no key,
 * so it's always on; AI-only mode needs a key.
 */
export function isItineraryParsingEnabled(): boolean {
  const parser = (process.env.ITINERARY_PARSER ?? "local").toLowerCase();
  return parser !== "openai" || Boolean(process.env.OPENAI_API_KEY);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. See .env.local.example.`
    );
  }
  return value;
}
