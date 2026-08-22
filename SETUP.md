# Zim 2026 setup

## 1. Configure Supabase

Create a Supabase project, then copy `.env.local.example` to `.env.local` and provide:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose it to a browser)
- `APP_PIN_PEPPER` generated with `openssl rand -hex 32`

Apply every SQL file in `supabase/migrations` in numeric order, including `0009_security_integrity.sql`. With the Supabase CLI linked to the project, use:

```bash
supabase db push
```

Migration 0009 is required. It makes shared tables and photos private, adds versioned sessions and one-time identity claim codes, enforces poll and pickup integrity, and installs transactional write functions.

Optional demo data is in `supabase/seed.sql`.

## 2. Provision the initial people

Set `APP_PIN_PEPPER` and the Supabase variables in `.env.local`, then run:

```bash
node scripts/provision-users.mjs
```

The script prints a different one-time claim code for each person. Share each code privately with its owner. Once the first admin signs in, additional people and replacement claim codes can be managed under **Admin → People**. Codes are displayed only when created or reset; the database stores only their HMAC hashes.

Changing `APP_PIN_PEPPER` invalidates existing PIN hashes, claim codes and sessions, so keep it stable and backed up securely.

## 3. Optional live flight data

For AeroDataBox through RapidAPI:

```dotenv
FLIGHT_PROVIDER=aerodatabox
AERODATABOX_API_KEY=...
AERODATABOX_RAPIDAPI_HOST=aerodatabox.p.rapidapi.com
```

Use `FLIGHT_PROVIDER=mock` for clearly labelled local demo data. OpenSky position credentials are optional; anonymous requests work with lower limits.

## 4. Optional itinerary parsing

`ITINERARY_PARSER=local` is free and keeps PDF content local. `local-with-ai-fallback` and `openai` require `OPENAI_API_KEY`; those modes send itinerary content to the configured OpenAI model when used.

## 5. Run and verify

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
npm run dev
```

Open `http://localhost:3000`. In production, HTTPS is required for the secure session cookie.

## Deployment safety

- Keep `.env.local`, the service-role key and the PIN pepper out of source control.
- Apply database migrations before deploying code that depends on them.
- Keep the `photos` bucket private; the app issues short-lived signed URLs.
- Back up Supabase before schema changes and periodically test identity reset and photo upload/delete flows.
