"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";

// Fun, family-friendly aviation facts shown while there are no flights yet.
const FACTS: string[] = [
  "A Boeing 747 is made of around six million parts.",
  "The wings of a plane can flex several metres in flight without breaking.",
  "The world's shortest scheduled flight, in Scotland, lasts under two minutes.",
  "Cruising jets fly around 35,000 feet up, higher than most mountains.",
  "Cabin air is refreshed every two to three minutes, cleaner than most offices.",
  "The little hole in the aircraft window keeps the cabin pressure balanced.",
  "Pilots and co-pilots eat different meals so one bad dish can't ground both.",
  "A jumbo jet burns roughly four litres of fuel every second while cruising.",
  "Contrails are just frozen water vapour trailing behind the engines.",
  "The black box is actually bright orange so it's easier to find.",
  "Some long-haul jets carry enough fuel to fill about six road tankers.",
  "A plane's tyres are inflated to about six times a car tyre's pressure.",
  "Johannesburg is one of the highest major airports, sitting a mile above the sea.",
  "The dimmed cabin lights on landing help your eyes adjust in case of evacuation.",
];

// Stable aviation photos (Unsplash). Plain <img> so no next/image config is needed.
const PHOTOS: { url: string; credit: string }[] = [
  { url: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=1200&q=70", credit: "Wing over the clouds" },
  { url: "https://images.unsplash.com/photo-1569154941061-e231b4725ef1?auto=format&fit=crop&w=1200&q=70", credit: "Jet at the gate" },
  { url: "https://images.unsplash.com/photo-1474302770737-173ee21bab63?auto=format&fit=crop&w=1200&q=70", credit: "Takeoff at dusk" },
  { url: "https://images.unsplash.com/photo-1542296332-2e4473faf563?auto=format&fit=crop&w=1200&q=70", credit: "Cabin window view" },
  { url: "https://images.unsplash.com/photo-1503146234398-d71f6bf9df61?auto=format&fit=crop&w=1200&q=70", credit: "Above the wing" },
  { url: "https://images.unsplash.com/photo-1610642372651-fe6e7bc60ba0?auto=format&fit=crop&w=1200&q=70", credit: "Approach to landing" },
];

export function PlaneFacts({
  framed = true,
  hint = "No family flights in the air right now.",
}: {
  framed?: boolean;
  hint?: string;
}) {
  // Start at 0 on both server and client to avoid hydration mismatch, then randomise after mount.
  const [i, setI] = useState(0);
  const [imgOk, setImgOk] = useState(true);

  const shuffle = useCallback(() => {
    setImgOk(true);
    setI((prev) => {
      let next = prev;
      while (next === prev) next = Math.floor(Math.random() * FACTS.length);
      return next;
    });
  }, []);

  useEffect(() => {
    // Defer the first shuffle so it runs after paint (avoids a synchronous
    // setState in the effect and any hydration mismatch).
    const kick = setTimeout(shuffle, 0);
    const id = setInterval(shuffle, 60_000);
    return () => {
      clearTimeout(kick);
      clearInterval(id);
    };
  }, [shuffle]);

  const fact = FACTS[i];
  const photo = PHOTOS[i % PHOTOS.length];

  return (
    <button
      type="button"
      onClick={shuffle}
      aria-label="Show another plane fact"
      className={cn(
        "group w-full overflow-hidden text-left",
        framed ? "zc-card p-0" : "rounded-[18px] bg-chip p-0"
      )}
    >
      <div className={cn("relative w-full overflow-hidden bg-flight", framed ? "h-44 sm:h-52" : "h-36")}>
        {imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo.url}
            alt={photo.credit}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
            onError={() => setImgOk(false)}
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-6xl" aria-hidden>
            ✈️
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent" />
        <span className="mono absolute bottom-2 right-3 text-[10px] font-semibold text-white/85">
          Tap for another
        </span>
      </div>
      <div className="px-6 py-6 text-center">
        <div className="mono text-[10.5px] font-bold uppercase tracking-wide text-honey">Did you know?</div>
        <p className="disp mx-auto mt-2 max-w-md text-lg font-extrabold leading-snug">{fact}</p>
        <p className="mt-3 text-sm text-muted">{hint}</p>
      </div>
    </button>
  );
}
