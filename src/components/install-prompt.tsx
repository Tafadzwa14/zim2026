"use client";

import { useEffect, useState } from "react";

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const KEY = "zc-install-dismissed";

/**
 * Prompts the user to add the app to their home screen. On Android/Chrome it
 * uses the native beforeinstallprompt; on iOS Safari (which has no such event)
 * it shows the manual Share → Add to Home Screen tip. Hidden once installed
 * (standalone) or dismissed for this browser.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    let dismissed = false;
    try {
      dismissed = localStorage.getItem(KEY) === "1";
    } catch {}
    if (dismissed) return;

    const ua = window.navigator.userAgent;
    const ios = /iphone|ipad|ipod/i.test(ua);
    const webkit = /webkit/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
    if (ios && webkit) {
      // Sync one-time platform detection after mount (needs window).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsIos(true);
      setShow(true);
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {}
    setShow(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    dismiss();
  };

  return (
    <div className="mt-5 flex items-center gap-3 rounded-[16px] border border-[color-mix(in_srgb,var(--honey)_35%,transparent)] bg-[color-mix(in_srgb,var(--honey)_10%,var(--card))] p-4">
      <span className="text-2xl" aria-hidden>📲</span>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-extrabold">Add Zim 2026 to your home screen</div>
        <div className="text-xs font-semibold text-muted">
          {isIos ? "Tap the Share button, then “Add to Home Screen”." : "Install it for one-tap access and a full-screen app."}
        </div>
      </div>
      {isIos ? (
        <button onClick={dismiss} className="whitespace-nowrap rounded-[10px] border border-line px-3 py-1.5 text-xs font-extrabold text-ink2">Got it</button>
      ) : (
        <button onClick={install} className="zc-btn whitespace-nowrap px-3 py-1.5 text-xs">Install</button>
      )}
    </div>
  );
}
