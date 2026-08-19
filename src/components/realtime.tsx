"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Refreshes server components when any shared table changes (spec section 46). */
export function Realtime({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!enabled) return;
    const sb = createClient();
    const channel = sb
      .channel("zim-realtime")
      .on("postgres_changes", { event: "*", schema: "public" }, () => router.refresh())
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, [enabled, router]);
  return null;
}
