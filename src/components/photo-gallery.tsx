"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useAction } from "@/lib/use-action";
import * as actions from "@/lib/actions";
import type { PhotoView } from "@/lib/repo/types";

/**
 * Swipeable, auto-advancing photo carousel. Drag/swipe on any pointer,
 * arrow buttons on desktop (hover), dots below. Auto-advance pauses while
 * hovering or mid-drag. Tapping a slide opens the full-size image.
 */
export function PhotoCarousel({ photos, aspect = "16 / 10", autoMs = 5000 }: { photos: PhotoView[]; aspect?: string; autoMs?: number }) {
  const n = photos.length;
  const [i, setI] = useState(0);
  const [drag, setDrag] = useState(0);
  const startX = useRef<number | null>(null);
  const didDrag = useRef(false);
  const paused = useRef(false);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (n <= 1) return;
    const id = setInterval(() => { if (!paused.current) setI((p) => (p + 1) % n); }, autoMs);
    return () => clearInterval(id);
  }, [n, autoMs]);

  if (n === 0) return null;
  // Clamp at render so a live delete that shrinks the set never leaves us
  // pointing past the end (no state-sync effect needed).
  const cur = i > n - 1 ? n - 1 : i;
  const go = (to: number) => setI(((to % n) + n) % n);

  function onDown(e: React.PointerEvent) {
    startX.current = e.clientX;
    didDrag.current = false;
    paused.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onMove(e: React.PointerEvent) {
    if (startX.current == null) return;
    const dx = e.clientX - startX.current;
    if (Math.abs(dx) > 5) didDrag.current = true;
    setDrag(dx);
  }
  function onUp() {
    if (startX.current == null) return;
    const w = frameRef.current?.clientWidth ?? 1;
    const dx = drag;
    startX.current = null;
    setDrag(0);
    paused.current = false;
    if (Math.abs(dx) > w * 0.15) go(dx < 0 ? cur + 1 : cur - 1);
  }

  return (
    <div
      ref={frameRef}
      className="zc-card group relative select-none overflow-hidden p-0"
      style={{ aspectRatio: aspect, touchAction: "pan-y" }}
      onMouseEnter={() => { paused.current = true; }}
      onMouseLeave={() => { paused.current = false; }}
    >
      <div
        className="flex h-full w-full"
        style={{
          transform: `translateX(calc(${-cur * 100}% + ${drag}px))`,
          transition: drag ? "none" : "transform .45s cubic-bezier(.22,.61,.36,1)",
        }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        {photos.map((p) => (
          <a
            key={p.id}
            href={p.url}
            target="_blank"
            rel="noreferrer"
            draggable={false}
            onClick={(e) => { if (didDrag.current) e.preventDefault(); }}
            className="relative h-full w-full flex-none"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.url}
              alt={p.caption ?? `Photo by ${p.uploader?.name ?? "someone"}`}
              className="h-full w-full object-cover"
              draggable={false}
              loading="lazy"
            />
            {(p.caption || p.uploader) && (
              <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/60 to-transparent px-3 pb-3 pt-8 text-xs font-bold text-white">
                {p.uploader && <span aria-hidden>{p.uploader.emoji}</span>}
                <span className="truncate">{p.caption ?? p.uploader?.name}</span>
              </span>
            )}
          </a>
        ))}
      </div>

      {n > 1 && (
        <>
          <button type="button" aria-label="Previous photo" onClick={() => go(cur - 1)} className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-lg text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 lg:flex">‹</button>
          <button type="button" aria-label="Next photo" onClick={() => go(cur + 1)} className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-lg text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100 lg:flex">›</button>
          <div className="absolute inset-x-0 bottom-2 flex flex-wrap justify-center gap-1.5 px-3">
            {photos.map((p, idx) => (
              <button
                key={p.id}
                type="button"
                aria-label={`Go to photo ${idx + 1}`}
                aria-current={idx === cur}
                onClick={() => go(idx)}
                className={cn("h-1.5 rounded-full transition-all", idx === cur ? "w-4 bg-white" : "w-1.5 bg-white/55")}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function PhotoGallery({ photos, meId, isAdmin }: { photos: PhotoView[]; meId: string; isAdmin: boolean }) {
  const { run, pending } = useAction();
  const fileRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (fileRef.current) fileRef.current.value = "";
    if (!files.length) return;
    setError(null);
    let done = 0;
    for (const file of files) {
      setUploading({ done, total: files.length });
      const fd = new FormData();
      fd.append("file", file);
      if (caption.trim()) fd.append("caption", caption.trim());
      const res = await actions.uploadPhoto(fd);
      if (res.ok === false) { setError(res.message); break; }
      done += 1;
    }
    setUploading(null);
    setCaption("");
  }

  return (
    <>
      <div className="zc-card p-3.5">
        <label className="zc-label" htmlFor="photo-caption">Caption (optional)</label>
        <input
          id="photo-caption"
          className="zc-input"
          placeholder="Add a note for the next upload"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          disabled={Boolean(uploading)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={Boolean(uploading)}
          className="zc-btn mt-3 w-full py-3 text-sm"
        >
          {uploading ? `Uploading ${uploading.done + 1} of ${uploading.total}…` : "📷 Add photos"}
        </button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
        <p className="mt-1.5 text-center text-[11px] text-muted">Pick one or several. Everyone can see and download them.</p>
        {error && <p className="mt-3 rounded-xl border border-[#f4dcac] bg-[#fff5e2] px-3 py-2 text-sm font-semibold text-[#b57d16]">{error}</p>}
      </div>

      {photos.length > 0 && (
        <div className="mt-4">
          <PhotoCarousel photos={photos} aspect="16 / 9" />
        </div>
      )}

      {photos.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {photos.map((p) => {
            const canDelete = p.uploaded_by === meId || isAdmin;
            return (
              <figure key={p.id} className="zc-card group relative overflow-hidden p-0">
                <a href={p.url} target="_blank" rel="noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={p.caption ?? `Photo by ${p.uploader?.name ?? "someone"}`}
                    className="aspect-square h-full w-full object-cover"
                    loading="lazy"
                  />
                </a>
                {(p.caption || p.uploader) && (
                  <figcaption className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/55 to-transparent px-2.5 pb-2 pt-6 text-[11px] font-bold text-white">
                    {p.uploader && <span aria-hidden>{p.uploader.emoji}</span>}
                    <span className="truncate">{p.caption ?? p.uploader?.name}</span>
                  </figcaption>
                )}
                {canDelete && (
                  <button
                    type="button"
                    aria-label="Remove photo"
                    disabled={pending}
                    onClick={() => run(() => actions.deletePhoto(p.id))}
                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-sm text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  >
                    🗑
                  </button>
                )}
              </figure>
            );
          })}
        </div>
      )}
    </>
  );
}
