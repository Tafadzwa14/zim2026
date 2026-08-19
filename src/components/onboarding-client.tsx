"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { EMOJIS } from "@/lib/display";
import { useAction } from "@/lib/use-action";
import * as actions from "@/lib/actions";
import type { PublicUser } from "@/lib/types";

export function OnboardingClient({ isMemory, users }: { isMemory: boolean; users: PublicUser[] }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [mode, setMode] = useState<"create" | "reclaim">("create");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
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
      <div className="p-[44px_26px_20px] text-white" style={{ background: "linear-gradient(150deg,#e0863a,#c74471)" }}>
        <div className="mono text-xs font-medium uppercase tracking-[0.1em] opacity-90">Welcome to</div>
        <h1 className="disp mt-2.5 text-[34px] font-extrabold leading-none">Zim 2026</h1>
        <p className="mt-1.5 font-bold opacity-95">Let&apos;s get you set up.</p>
      </div>

      <div className="mx-auto max-w-[480px] p-[22px_26px_44px]">
        <div className="mb-4 flex gap-1.5 rounded-2xl bg-chip p-1">
          {(["create", "reclaim"] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={cn("flex-1 rounded-xl py-2 text-[13px] font-extrabold", mode === m ? "bg-card text-ink shadow-sm" : "text-ink2")}>
              {m === "create" ? "I'm new" : "Reclaim identity"}
            </button>
          ))}
        </div>

        {mode === "create" ? (
          <form onSubmit={(e) => { e.preventDefault(); run(() => actions.createIdentity({ name, username, emoji, pin: pin.join("") }), { onSuccess: () => router.push("/") }); }}>
            <label className="zc-label">Your name</label>
            <input className="zc-input" placeholder="e.g. Taffie" value={name} onChange={(e) => setName(e.target.value)} />
            <label className="zc-label">Pick a username</label>
            <input className="zc-input" placeholder="e.g. taffie" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} />
            <label className="zc-label">Choose your emoji — <span className="text-lg">{emoji}</span></label>
            <input className="zc-input" placeholder="Search emoji (lion, flower, car…)" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="mt-2 grid max-h-44 grid-cols-7 gap-1 overflow-y-auto">
              {grid.map(([e]) => (
                <button type="button" key={e} onClick={() => setEmoji(e)} className={cn("rounded-lg py-1.5 text-2xl", e === emoji && "bg-[#fbecd8] dark:bg-[color-mix(in_srgb,var(--honey)_22%,transparent)]")}>{e}</button>
              ))}
            </div>
            <label className="zc-label">Set a 4-digit PIN</label>
            {pinBox(pin, setPin, pinRefs)}
            <p className="text-xs text-muted">Your PIN lets you reclaim your identity on another device. Stored hashed, never in plain text.</p>
            <button className="zc-btn mt-5 w-full" disabled={pending}>Enter Zim 2026 →</button>
          </form>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); run(() => actions.reclaimIdentity({ username: rUser, pin: rPin.join("") }), { onSuccess: () => router.push("/") }); }}>
            <label className="zc-label">Username</label>
            <input className="zc-input" placeholder="your username" value={rUser} onChange={(e) => setRUser(e.target.value.toLowerCase())} />
            <label className="zc-label">4-digit PIN</label>
            {pinBox(rPin, setRPin, rPinRefs)}
            <button className="zc-btn mt-5 w-full" disabled={pending}>Restore identity</button>
          </form>
        )}

        {isMemory && (
          <div className="mt-8 border-t border-line pt-5">
            <div className="zc-label">Demo mode · continue as</div>
            <p className="-mt-1 mb-2 text-xs text-muted">No Supabase connected yet. Pick a seeded family member to explore.</p>
            <div className="flex flex-wrap gap-2">
              {users.map((u) => (
                <button key={u.id} onClick={() => run(() => actions.switchUser(u.id), { onSuccess: () => router.push("/") })} className="zc-chip">
                  <span className="text-lg" aria-hidden>{u.emoji}</span>{u.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
