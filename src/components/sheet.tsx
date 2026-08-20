"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open);

  // Mount synchronously whenever we should be open. Self-correcting: any render
  // where we're open but not yet mounted fixes it (rather than firing only on an
  // open/close transition), so the sheet can never get stuck closed — and it
  // still shows in a hidden/background tab, where effects run but rAF is paused.
  if (open && !mounted) setMounted(true);

  // Drive the enter/exit animation from `open`, and unmount after the exit.
  useEffect(() => {
    if (open) {
      // Animate in on the next frame; a timer backstops a paused rAF (hidden or
      // backgrounded tab) so the sheet still becomes visible either way.
      const r = requestAnimationFrame(() => setShown(true));
      const t = setTimeout(() => setShown(true), 60);
      return () => {
        cancelAnimationFrame(r);
        clearTimeout(t);
      };
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), 260);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <>
      <div
        onClick={onClose}
        className={cn("fixed inset-0 z-50 bg-black/40 transition-opacity duration-200", shown ? "opacity-100" : "opacity-0")}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "fixed z-[60] flex max-h-[88%] flex-col bg-paper text-ink shadow-2xl transition-all duration-300",
          "bottom-0 left-1/2 w-full max-w-[460px] -translate-x-1/2 rounded-t-[26px]",
          "lg:bottom-auto lg:top-1/2 lg:rounded-[24px]",
          shown
            ? "translate-y-0 opacity-100 lg:-translate-y-1/2"
            : "translate-y-full opacity-0 lg:translate-y-[calc(-50%+16px)]"
        )}
      >
        <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-[#d9cdb8] lg:hidden" />
        <div className="flex items-center justify-between px-5 pb-2 pt-2">
          <h3 className="disp text-xl font-extrabold">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="flex h-8 w-8 items-center justify-center rounded-full bg-chip text-base text-ink2">
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-7">{children}</div>
      </div>
    </>
  );
}
