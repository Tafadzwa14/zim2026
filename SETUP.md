# Zim 2026 — setup

A private family command centre for the September 2026 Zimbabwe trip.
Next.js + TypeScript + Tailwind + Supabase, with a pluggable flight provider.

## What you need to provide

Two accounts create the credentials this app needs. Nothing goes in git;
it all lives in a gitignored `.env.local`.

### 1. Supabase

1. Create a project at https://supabase.com.
2. In **Project Settings → API**, copy the Project URL, the `anon` public key,
   and the `service_role` key.
3. In the **SQL editor**, run the migrations in order:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_policies.sql`
4. Optional: run `supabase/seed.sql` for demo family, travel and logistics.

### 2. AeroDataBox (flight data)

1. Subscribe to AeroDataBox on RapidAPI:
   https://rapidapi.com/aedbx-aedbx/api/aerodatabox
2. Copy your RapidAPI key.

Prefer a different provider? Implement `FlightProvider`
(`src/lib/flights/provider.ts`) and point the factory at it. No UI changes.

## Configure and run

```bash
cp .env.local.example .env.local   # then fill in the values
npm install
npm run dev                        # http://localhost:3000
```

The home page shows a live setup checklist until Supabase is connected and
the migrations have run, then it confirms the connection.

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | public | Anon key for browser reads and Realtime |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | Server-side writes; bypasses RLS |
| `FLIGHT_PROVIDER` | secret | `aerodatabox` or `mock` |
| `AERODATABOX_API_KEY` | secret | RapidAPI key |
| `AERODATABOX_RAPIDAPI_HOST` | secret | Defaults to `aerodatabox.p.rapidapi.com` |
| `APP_PIN_PEPPER` | secret | Extra secret mixed into PIN hashes |
| `ADMIN_SETUP_TOKEN` | secret | One-time token to claim the first admin |

## Security notes

- The `service_role` key is server-only. Never import it into a client component.
- PINs are hashed, never stored in plaintext (spec section 49).
- RLS is on. The browser only reads the shared, non-sensitive tables; all
  writes go through server actions using the service role after the server
  verifies identity and permissions.
- The private URL is convenience, not authorization.
