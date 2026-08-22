"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Privacy-safe collaborative refresh. Direct anonymous Realtime subscriptions
 * would bypass the signed app session, so a visible tab asks the authenticated
 * server tree for fresh data at a modest interval instead.
 */
export function Realtime({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    const refresh = () => { if (document.visibilityState === "visible") router.refresh(); };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [enabled, router]);
  return null;
}
