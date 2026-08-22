import "server-only";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}. See .env.local.example.`);
  return value;
}

function productionRequired(name: string, developmentFallback: string): string {
  if (process.env[name]) return process.env[name]!;
  if (process.env.NODE_ENV === "production") return required(name);
  return developmentFallback;
}

export const serverEnv = {
  get supabaseServiceRoleKey() { return required("SUPABASE_SERVICE_ROLE_KEY"); },
  get flightProvider() { return process.env.FLIGHT_PROVIDER ?? "mock"; },
  get aerodataboxKey() { return process.env.AERODATABOX_API_KEY ?? ""; },
  get aerodataboxHost() { return process.env.AERODATABOX_RAPIDAPI_HOST ?? "aerodatabox.p.rapidapi.com"; },
  get positionProvider() { return process.env.FLIGHT_POSITION_PROVIDER ?? "opensky"; },
  get openskyClientId() { return process.env.OPENSKY_CLIENT_ID ?? ""; },
  get openskyClientSecret() { return process.env.OPENSKY_CLIENT_SECRET ?? ""; },
  get pinPepper() { return productionRequired("APP_PIN_PEPPER", "zim-local-development-only"); },
  get openaiApiKey() { return process.env.OPENAI_API_KEY ?? ""; },
  get openaiModel() { return process.env.OPENAI_MODEL ?? "gpt-5.6-luna"; },
  get itineraryParser() { return (process.env.ITINERARY_PARSER ?? "local").toLowerCase(); },
};

export function isItineraryParsingEnabled(): boolean {
  return serverEnv.itineraryParser !== "openai" || Boolean(serverEnv.openaiApiKey);
}
