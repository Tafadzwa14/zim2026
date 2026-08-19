"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/providers";
import type { ActionResult } from "@/lib/actions";

/**
 * Runs a server action, toasts its result, and refreshes server components.
 * Works in both memory and Supabase modes (server action revalidates, then
 * router.refresh re-renders).
 */
export function useAction() {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function run<R extends ActionResult>(
    thunk: () => Promise<R>,
    opts?: { onSuccess?: (r: R) => void; silent?: boolean }
  ) {
    startTransition(async () => {
      try {
        const res = await thunk();
        if (res && res.ok === false) {
          toast(res.message, "⚠️");
          return;
        }
        if (res && res.message && !opts?.silent) toast(res.message);
        opts?.onSuccess?.(res);
        router.refresh();
      } catch {
        toast("Couldn't update — try again", "⚠️");
      }
    });
  }

  return { run, pending };
}
