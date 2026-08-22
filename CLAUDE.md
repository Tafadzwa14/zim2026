@AGENTS.md

# Zim 2026 — project notes for Claude

Private, mobile-first family hub for the September 2026 Zimbabwe trip and
wedding. Product spec lives in `ZIM-2026-BUILD-SPEC.md` (in the owner's
Downloads); section 39A is the approved design system.

## Stack

- Next.js 16 (App Router, Turbopack), React 19, TypeScript, `src/` dir.
- Tailwind v4 (CSS-first). Design tokens and component classes in
  `src/app/globals.css`; fonts wired in `src/app/layout.tsx`
  (Bricolage Grotesque / Nunito / IBM Plex Mono).
- Supabase (Postgres, RLS, Realtime). Custom identity (username + hashed
  PIN), NOT Supabase Auth.
- Flight data behind `FlightProvider` (`src/lib/flights`). AeroDataBox
  adapter + mock; env `FLIGHT_PROVIDER` selects.

## Conventions

- Never import server secrets (`serverEnv`, `admin.ts`, `aerodatabox.ts`)
  into a client component. Those files use `import "server-only"`.
- All writes go through server actions using the service-role client after
  verifying identity and permissions. The browser only reads shared tables
  (via RLS) and subscribes to Realtime.
- Read people through the `users_public` view, never the `users` base table
  (which holds `pin_hash`).
- Use the design tokens (`bg-paper`, `text-ink`, `text-muted`, `bg-honey`,
  `text-berry`, `bg-flight`, `text-good`, `.disp`, `.mono`, `.zc-card`,
  `.zc-btn`, `.zc-chip`, `.zc-input`) rather than raw hex. Both light and
  dark themes are token-driven. Theme-aware gradients live in the
  `--grad-wed`, `--grad-dinner`, `--grad-onboard`, and `--flight-radial`
  variables — reference those from inline styles, never a baked-in hex, so
  banners flip with the mode.
- Palette is cool (approved v2): light is **Slate Editorial** (cool
  off-white paper, slate ink, teal primary), dark is **Midnight** (charcoal-
  navy paper, cyan primary). NOTE the accent token names are legacy: `--honey`
  now holds the teal/cyan primary and `--berry` a cooled pink; the wedding
  countdown (plum → pink) is the one warm moment. `--flight` is a cool-dark
  navy hero. Greens are semantic status only. No Zimbabwe flag motif or flag
  palette (removed at design review).
- Australian English in copy. Concise, friendly, family tone (spec 69).
- Clocks are 24-hour everywhere, zero-padded (`06:45`, `19:05`). Format
  through `fmtTime`/`fmtTimeIn`/`fmtAirportTime` rather than a fresh
  `Intl.DateTimeFormat`; never render a dayPeriod. Parsing an itinerary's
  AM/PM input text is a separate concern (`itinerary-local.ts`).

## Layout

- Mobile: bottom-nav app (Home, Calendar, Flights, Family, More).
- Desktop (>=1024px): command centre (sidebar + stat bar + dashboard grid),
  per spec section 36. Tablet step still to build.

## Status

- Done: foundation — scaffold, design system, Supabase clients + schema +
  RLS + seed, flight provider abstraction, setup-gated home, dark mode
  (Slate light / Midnight dark, token-driven).
- Next: identity/onboarding (PIN hashing, reclaim), data-access layer +
  server actions, port screens (home, flights, calendar, family, more),
  Realtime, admin, tablet, PWA.

## Commands

```bash
npm run dev     # dev server
npm run build   # production build (typechecks + lints)
npm run lint
```
