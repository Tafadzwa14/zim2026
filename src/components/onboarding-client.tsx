"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { EMOJIS } from "@/lib/display";
import { useAction } from "@/lib/use-action";
import * as actions from "@/lib/actions";
import type { PublicUser } from "@/lib/types";

export function OnboardingClient({ isMemory, pending, claimed }: { isMemory: boolean; pending: PublicUser[]; claimed: PublicUser[] }) {
  const router = useRouter();
  const { run, pending: busy } = useAction();
  const [mode, setMode] = useState<"claim" | "reclaim">("claim");
  const [userId, setUserId] = useState("");
  const [emoji, setEmoji] = useState("🏎️");
  const [search, setSearch] = useState("");
  const [pin, setPin] = useState(["", "", "", ""]);
  const [rUser, setRUser] = useState("");
  const [rPin, setRPin] = useState(["", "", "", ""]);
  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const rPinRefs = useRef<(HTMLInputElement | null)[]>([]);

  const grid = useMemo(() => {
    const q = search.toLowerCase();
    const list = EMOJIS.filter(([e, kw]) => !q || kw.includes(q) || e === q);
    return list.length ? list : EMOJIS;
  }, [search]);

  const chosen = pending.find((u) => u.id === userId) ?? null;

  function pinBox(values: string[], setValues: (v: string[]) => void, refs: React.RefObject<(HTMLInputElement | null)[]>) {
    return (
      <div className="my-2 flex justify-center gap-2.5">
        {values.map((v, i) => (
          <input
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            inputMode="numeric"
            maxLength={1}
            value={v}
            aria-label={`PIN digit ${i + 1}`}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, "").slice(-1);
              const next = [...values];
              next[i] = d;
              setValues(next);
              if (d && i < 3) refs.current[i + 1]?.focus();
            }}
            className="mono h-15 w-13 rounded-2xl border-[1.5px] border-line bg-card text-center text-2xl font-extrabold focus:border-honey focus:outline-none"
            style={{ width: 52, height: 60 }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-paper">
      <div className="p-[44px_26px_20px] text-white" style={{ background: "var(--grad-onboard)" }}>
        <div className="mono text-xs font-medium uppercase tracking-[0.1em] opacity-90">Welcome to</div>
        <h1 className="disp mt-2.5 text-[34px] font-extrabold leading-none">Zim 2026</h1>
        <p className="mt-1.5 font-bold opacity-95">Let&apos;s get you set up.</p>
      </div>

      <div className="mx-auto max-w-[480px] p-[22px_26px_44px]">
        <div className="mb-4 flex gap-1.5 rounded-2xl bg-chip p-1">
          {(["claim", "reclaim"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cn("flex-1 rounded-xl py-2 text-[13px] font-extrabold", mode === m ? "bg-card text-ink shadow-sm" : "text-ink2")}>
              {m === "claim" ? "I'm new" : "Reclaim identity"}
            </button>
          ))}
        </div>

        {mode === "claim" ? (
          pending.length === 0 ? (
            <div className="zc-card text-center">
              <p className="font-bold text-ink">No one to set up yet</p>
              <p className="mt-1.5 text-sm text-muted">Ask whoever set up the app to add you to the family list, then come back here to choose your emoji and PIN.</p>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); run(() => actions.claimIdentity({ userId, emoji, pin: pin.join("") }), { onSuccess: () => router.push("/") }); }}>
              <label className="zc-label">Who are you?</label>
              <select
                className="zc-input"
                value={userId}
                onChange={(e) => {
                  setUserId(e.target.value);
                  const u = pending.find((p) => p.id === e.target.value);
                  if (u) setEmoji(u.emoji);
                }}
              >
                <option value="" disabled>Pick your name…</option>
                {pending.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>

              <label className="zc-label">Choose your emoji — <span className="text-lg">{emoji}</span></label>
              <input className="zc-input" placeholder="Search emoji (lion, flower, car…)" value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="mt-2 grid max-h-44 grid-cols-7 gap-1 overflow-y-auto">
                {grid.map(([e]) => (
                  <button type="button" key={e} onClick={() => setEmoji(e)} className={cn("rounded-lg py-1.5 text-2xl", e === emoji && "bg-[color-mix(in_srgb,var(--honey)_16%,transparent)]")}>{e}</button>
                ))}
              </div>

              <label className="zc-label">Set a 4-digit PIN</label>
              {pinBox(pin, setPin, pinRefs)}
              <p className="text-xs text-muted">Your PIN lets you reclaim your identity on another device. Stored hashed, never in plain text.</p>
              <button className="zc-btn mt-5 w-full" disabled={busy || !chosen}>Enter Zim 2026 →</button>
            </form>
          )
        ) : claimed.length === 0 ? (
          <div className="zc-card text-center">
            <p className="font-bold text-ink">No one to reclaim yet</p>
            <p className="mt-1.5 text-sm text-muted">Once someone has set up their identity, they can pick their name here to sign back in.</p>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); run(() => actions.reclaimIdentity({ username: rUser, pin: rPin.join("") }), { onSuccess: () => router.push("/") }); }}>
            <label className="zc-label">Who are you?</label>
            <select className="zc-input" value={rUser} onChange={(e) => setRUser(e.target.value)}>
              <option value="" disabled>Pick your name…</option>
              {claimed.map((u) => (
                <option key={u.id} value={u.username}>{u.emoji} {u.name}</option>
              ))}
            </select>
            <label className="zc-label">4-digit PIN</label>
            {pinBox(rPin, setRPin, rPinRefs)}
            <button className="zc-btn mt-5 w-full" disabled={busy || !rUser}>Restore identity</button>
            <button
              type="button"
              disabled={busy || !rUser}
              onClick={() => run(() => actions.requestPinReset(rUser))}
              className="mt-3 w-full text-center text-xs font-bold text-muted underline disabled:opacity-50"
            >
              Forgot your PIN? Ask an admin to reset it
            </button>
          </form>
        )}

        {isMemory && (
          <p className="mt-8 border-t border-line pt-5 text-xs text-muted">
            Demo mode — no Supabase connected. The list above is seeded family; claiming one lets you explore as them.
          </p>
        )}
      </div>
    </div>
  );
}
