import type { ReactNode } from "react";
import { isSupabaseConfigured } from "@/lib/env";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type DbState =
  | { kind: "ok"; appTitle: string; family: number; flights: number }
  | { kind: "no-tables" }
  | { kind: "error"; message: string };

async function checkDb(): Promise<DbState> {
  try {
    const supabase = await createServerSupabase();
    const settings = await supabase.from("app_settings").select("app_title").limit(1).single();
    if (settings.error) {
      if (settings.error.code === "42P01" || /does not exist/i.test(settings.error.message)) {
        return { kind: "no-tables" };
      }
      return { kind: "error", message: settings.error.message };
    }
    const [{ count: family }, { count: flights }] = await Promise.all([
      supabase.from("users_public").select("*", { count: "exact", head: true }),
      supabase.from("flight_legs").select("*", { count: "exact", head: true }),
    ]);
    return {
      kind: "ok",
      appTitle: settings.data?.app_title ?? "Zim 2026",
      family: family ?? 0,
      flights: flights ?? 0,
    };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mono flex h-7 w-7 flex-none items-center justify-center rounded-lg bg-honey text-sm font-bold text-white">
        {n}
      </span>
      <span className="pt-0.5 text-[15px] leading-relaxed text-ink2">{children}</span>
    </li>
  );
}

export default async function Home() {
  const configured = isSupabaseConfigured();
  const db = configured ? await checkDb() : null;
  const connected = db?.kind === "ok";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-6 py-14">
      <p className="zc-eyebrow mb-3">Family command centre · foundation</p>
      <h1 className="disp text-4xl font-extrabold tracking-tight">Zim 2026</h1>
      <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink2">
        The webapp scaffold is in place — Next.js, the approved design system, the flight
        provider abstraction, and the Supabase schema. Finish the connection below and the
        family hub comes online.
      </p>

      <div className="zc-card mt-8 p-5">
        <div className="flex items-center gap-3">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: connected ? "var(--good)" : "var(--warn)" }}
          />
          <span className="disp text-lg font-extrabold">
            {connected ? "Supabase connected" : "Setup needed"}
          </span>
        </div>

        {connected && db?.kind === "ok" ? (
          <p className="mt-2 text-[15px] text-ink2">
            Reading <b className="text-ink">{db.appTitle}</b> · {db.family} family members and{" "}
            {db.flights} flight legs in the database. Screens land next.
          </p>
        ) : (
          <ol className="mt-4 flex flex-col gap-3.5">
            <Step n={1}>
              Create a Supabase project, then copy <span className="mono">.env.local.example</span>{" "}
              to <span className="mono">.env.local</span> and fill in the URL and keys.
            </Step>
            <Step n={2}>
              Run <span className="mono">supabase/migrations/0001_schema.sql</span> then{" "}
              <span className="mono">0002_policies.sql</span> in the Supabase SQL editor. Optionally
              run <span className="mono">supabase/seed.sql</span> for demo content.
            </Step>
            <Step n={3}>
              Add your AeroDataBox (RapidAPI) key for live flights, then restart{" "}
              <span className="mono">npm run dev</span>.
            </Step>
          </ol>
        )}

        {db?.kind === "no-tables" && (
          <p className="mt-4 rounded-xl border border-line bg-chip px-3 py-2 text-sm font-semibold text-ink2">
            Connected to Supabase, but the tables are missing. Run the migrations in{" "}
            <span className="mono">supabase/migrations</span>.
          </p>
        )}
        {db?.kind === "error" && (
          <p className="mt-4 rounded-xl border border-line bg-chip px-3 py-2 text-sm font-semibold text-ink2">
            Could not reach the database: {db.message}
          </p>
        )}
      </div>

      <p className="mono mt-6 text-center text-xs text-muted">
        Private family hub · noindex · v1 foundation
      </p>
    </main>
  );
}
