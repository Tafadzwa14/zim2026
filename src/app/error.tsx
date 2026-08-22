"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("[app error]", error); }, [error]);
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-5xl" aria-hidden>🛠️</div>
      <h1 className="disp text-2xl font-extrabold">Something went wrong</h1>
      <p className="text-sm text-muted">Your data is safe. Try loading this screen again.</p>
      <button type="button" onClick={reset} className="rounded-xl bg-honey px-5 py-2.5 text-sm font-extrabold text-white">Try again</button>
    </main>
  );
}
