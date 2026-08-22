# Zim 2026

A private family command centre for the September 2026 Zimbabwe trip. It combines multi-leg flight tracking, per-arrival airport pickups, plans, tasks, shopping, polls, important information and private photo sharing.

## Run locally

```bash
cp .env.local.example .env.local
npm install
npm run dev
```

Configure Supabase and apply every migration through `0009_security_integrity.sql` before using Supabase mode. Full instructions are in [SETUP.md](./SETUP.md).

## Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

The app uses signed, versioned server sessions. Supabase shared tables and the photo bucket are not readable through the browser anon key; authenticated reads and writes go through authorised server code.
