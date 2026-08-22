"use client";

import { useTransition } from "react";
import { useToast } from "@/components/providers";
import type { ActionResult } from "@/lib/actions";

/**
 * Runs a server action and toasts its result. Successful actions revalidate
 * their affected routes on the server, so the returned UI is already fresh.
 */
export function useAction() {
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
      } catch (err) {
        const message = err instanceof Error && err.message ? err.message : "try again";
        toast(`Couldn't update — ${message}`, "⚠️");
      }
    });
  }

  return { run, pending };
}
