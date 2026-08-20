"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Wraps a home-screen card so it can be dismissed for this browser. The
 * `id` should change when the underlying content changes (e.g. a new dinner
 * or a new pinned notice), so a fresh card reappears after an old one was
 * hidden.
 */
export function Dismissable({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const key = `zc-dismissed:${id}`;
  const [hidden, setHidden] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // One-time sync from localStorage (an external store) after mount, so SSR
    // and first client render agree before we hide.
    let hide = false;
    try {
      hide = localStorage.getItem(key) === "1";
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHidden(hide);
    setReady(true);
  }, [key]);

  if (ready && hidden) return null;

  return (
    <div className={cn("relative", className)}>
      {children}
      <button
        aria-label="Dismiss"
        onClick={() => {
          try {
            localStorage.setItem(key, "1");
          } catch {}
          setHidden(true);
        }}
        className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-full bg-black/25 text-sm font-extrabold text-white backdrop-blur-sm hover:bg-black/40"
      >
        ✕
      </button>
    </div>
  );
}
