"use client";

import { useState } from "react";
import { useAction } from "@/lib/use-action";
import * as actions from "@/lib/actions";
import { resolveLayout, type ResolvedWidget, type Surface } from "@/lib/home-layout";

interface Item { id: string; label: string; icon: string; hint?: string; visible: boolean }

function toItems(list: ResolvedWidget[]): Item[] {
  return list.map((w) => ({ id: w.id, label: w.label, icon: w.icon, hint: w.hint, visible: w.visible }));
}

function SurfacePanel({ surface, label, initial }: { surface: Surface; label: string; initial: ResolvedWidget[] }) {
  const { run, pending } = useAction();
  const [items, setItems] = useState<Item[]>(() => toItems(initial));
  const [dirty, setDirty] = useState(false);

  function move(index: number, dir: -1 | 1) {
    const next = [...items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    setDirty(true);
  }
  function toggle(index: number) {
    const next = items.map((it, i) => (i === index ? { ...it, visible: !it.visible } : it));
    setItems(next);
    setDirty(true);
  }
  function save() {
    const order = items.map((it) => it.id);
    const hidden = items.filter((it) => !it.visible).map((it) => it.id);
    run(() => actions.setHomeLayout(surface, order, hidden), { onSuccess: () => setDirty(false) });
  }
  function reset() {
    run(() => actions.resetHomeLayout(surface), {
      onSuccess: () => { setItems(toItems(resolveLayout(surface))); setDirty(false); },
    });
  }

  return (
    <div className="zc-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="disp text-base font-extrabold">{label}</h3>
        <span className="mono ml-auto text-[10.5px] uppercase tracking-wide text-muted">{items.filter((i) => i.visible).length}/{items.length} shown</span>
      </div>

      <ul className="flex flex-col gap-1.5">
        {items.map((it, i) => (
          <li key={it.id} className={`flex items-center gap-2.5 rounded-[13px] border border-line2 px-3 py-2.5 ${it.visible ? "bg-card" : "bg-chip opacity-60"}`}>
            <span className="text-lg" aria-hidden>{it.icon}</span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-[14px] font-extrabold">{it.label}</span>
              {it.hint && <span className="truncate text-[11px] text-muted">{it.hint}</span>}
            </span>
            <span className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => toggle(i)}
                aria-label={it.visible ? `Hide ${it.label}` : `Show ${it.label}`}
                className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-line bg-paper text-sm"
              >{it.visible ? "👁️" : "🚫"}</button>
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                aria-label={`Move ${it.label} up`}
                className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-line bg-paper text-sm disabled:opacity-30"
              >↑</button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
                aria-label={`Move ${it.label} down`}
                className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-line bg-paper text-sm disabled:opacity-30"
              >↓</button>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex gap-2">
        <button className="zc-btn flex-1 py-2.5 text-sm" onClick={save} disabled={pending || !dirty}>Save {label.toLowerCase()}</button>
        <button className="zc-btn zc-btn-ghost py-2.5 text-sm" onClick={reset} disabled={pending}>Reset</button>
      </div>
    </div>
  );
}

export function HomeLayoutEditor({ mobile, desktop }: { mobile: ResolvedWidget[]; desktop: ResolvedWidget[] }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted">Choose which cards appear on your home screen and the order they show in. Mobile and desktop are set separately.</p>
      <SurfacePanel surface="mobile" label="Mobile home" initial={mobile} />
      <SurfacePanel surface="desktop" label="Desktop dashboard" initial={desktop} />
    </div>
  );
}
