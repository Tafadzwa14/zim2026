import Link from "next/link";
import { cn } from "@/lib/cn";
import { fmtTime, progressFromTimes, remainingLabel } from "@/lib/format";
import { flightStatusMeta } from "@/lib/display";
import type { TravelView } from "@/lib/repo/types";
import type { FlightLeg } from "@/lib/types";

// Plane position along quadratic bezier P0(30,84) P1(200,20) P2(370,84).
function planeGlyph(p: number) {
  const t = Math.min(1, Math.max(0, p));
  const mt = 1 - t;
  const x = mt * mt * 30 + 2 * mt * t * 200 + t * t * 370;
  const y = mt * mt * 84 + 2 * mt * t * 20 + t * t * 84;
  const dx = 2 * mt * (200 - 30) + 2 * t * (370 - 200);
  const dy = 2 * mt * (20 - 84) + 2 * t * (84 - 20);
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  return { x, y, ang };
}

export function RouteMap({
  progress,
  completed = "#e8a24e",
  plane = "#ffffff",
}: {
  progress: number;
  completed?: string;
  plane?: string;
}) {
  const pct = Math.round(progress * 100);
  const g = planeGlyph(progress);
  return (
    <svg className="mt-1 block w-full" viewBox="0 0 400 108" fill="none" aria-hidden>
      <path d="M30 84 Q200 20 370 84" stroke="rgba(255,255,255,.16)" strokeWidth="3" strokeDasharray="1 8" strokeLinecap="round" />
      <path className="zc-flow" d="M30 84 Q200 20 370 84" stroke={completed} strokeWidth="3" pathLength={100} strokeDasharray={`${pct} 100`} strokeLinecap="round" />
      <circle cx="30" cy="84" r="5" fill={completed} />
      <circle cx="370" cy="84" r="5" fill="var(--flight)" stroke="rgba(255,255,255,.4)" strokeWidth="2" />
      {progress > 0 && progress < 1 && (
        <g transform={`translate(${g.x.toFixed(1)} ${g.y.toFixed(1)}) rotate(${g.ang.toFixed(1)})`}>
          <path d="M-9 0 L7 0 M-9 0 L-4 -4 M-9 0 L-4 4 M2 0 L7 -5 M2 0 L7 5" stroke={plane} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="9" cy="0" r="2.7" fill={plane} />
        </g>
      )}
    </svg>
  );
}

function StatusBadge({ status }: { status: FlightLeg["status"] }) {
  const meta = flightStatusMeta(status);
  const tone =
    meta.tone === "air"
      ? "bg-[#3fd98a] text-[#0c2b1a]"
      : meta.tone === "land"
        ? "bg-[#a9c7e0] text-[#20303f]"
        : meta.tone === "cancel"
          ? "bg-[#e0708f] text-[#3a0f1c]"
          : "bg-[#f0d9b6] text-[#5a4632]";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wide", tone)}>
      {status === "air" && <span className="zc-pulse h-1.5 w-1.5 rounded-full bg-current" />}
      {meta.label}
    </span>
  );
}

export function FlightCard({ travel, full = false }: { travel: TravelView; full?: boolean }) {
  const leg = travel.activeLeg;
  if (!leg) return null;
  const dep = leg.estimated_departure ?? leg.scheduled_departure;
  const arr = leg.estimated_arrival ?? leg.scheduled_arrival;
  const progress = leg.status === "landed" ? 1 : leg.status === "air" ? (leg.progress ?? progressFromTimes(dep, arr)) : 0;
  const driver = travel.driver;

  const inner = (
    <div className="relative overflow-hidden rounded-[24px] bg-flight p-[19px] text-white shadow-[0_18px_34px_-20px_rgba(29,23,16,.7)]">
      <span className="pointer-events-none absolute -right-8 -top-11 h-48 w-48 rounded-full" style={{ background: "radial-gradient(circle,rgba(232,162,78,.32),transparent 68%)" }} />
      <div className="relative flex items-center justify-between">
        <div>
          <span className="mono text-[18px] font-semibold">{leg.flight_number}</span>
          <span className="ml-1.5 text-[11px] font-bold uppercase tracking-wide text-[#c3b4a0]">{leg.airline_name}</span>
        </div>
        <StatusBadge status={leg.status} />
      </div>
      <div className="relative mt-3.5 flex items-end justify-between">
        <div>
          <div className="mono text-[30px] font-semibold leading-none">{leg.origin_airport}</div>
          <div className="mt-0.5 text-[11px] font-bold text-[#c3b4a0]">{leg.origin_city}</div>
        </div>
        <div className="mono pb-1 text-xs font-semibold text-honey2">{leg.status === "air" ? `${Math.round(progress * 100)}%` : ""}</div>
        <div className="text-right">
          <div className="mono text-[30px] font-semibold leading-none">{leg.destination_airport}</div>
          <div className="mt-0.5 text-[11px] font-bold text-[#c3b4a0]">{leg.destination_city}</div>
        </div>
      </div>
      <RouteMap progress={progress} />
      <div className="relative mt-3.5 flex gap-[7px]">
        {[
          { v: fmtTime(arr), k: leg.status === "landed" ? "Arrived" : "Lands" },
          { v: leg.delay_minutes && leg.delay_minutes > 0 ? `+${leg.delay_minutes} min` : "On time", k: "Delay", late: (leg.delay_minutes ?? 0) > 0 },
          { v: leg.status === "landed" ? "✓" : remainingLabel(dep, arr, progress) || "—", k: leg.status === "landed" ? "Status" : "To go" },
          { v: leg.aircraft_type_code ?? "—", k: "Aircraft" },
        ].map((m, i) => (
          <div key={i} className="flex-1 rounded-[14px] border border-white/5 bg-white/[.07] px-1.5 py-2.5 text-center">
            <div className={cn("mono text-[14px] font-semibold", m.late && "text-[#f0b84e]")}>{m.v}</div>
            <div className="mt-1 text-[9px] font-bold uppercase tracking-wide text-[#c3b4a0]">{m.k}</div>
          </div>
        ))}
      </div>
      {full && (
        <>
          <div className="relative mt-3 flex items-center gap-2.5 border-t border-white/10 pt-3">
            <span className="mono w-[70px] flex-none text-[10px] uppercase tracking-wide text-[#c3b4a0]">On board</span>
            <span className="text-[13.5px] font-extrabold">{travel.members.map((m) => `${m.emoji} ${m.name}`).join(", ") || travel.title}</span>
          </div>
          {travel.pickup?.requested && (
            <div className="relative mt-2.5 flex items-center gap-2.5">
              <span className="mono w-[70px] flex-none text-[10px] uppercase tracking-wide text-[#c3b4a0]">Pickup</span>
              {driver ? (
                <>
                  <span className="text-[13.5px] font-extrabold">{driver.emoji} {driver.name}</span>
                  <span className="mono ml-auto text-[11px] font-semibold text-[#3fd98a]">Claimed ✓</span>
                </>
              ) : (
                <span className="text-[13.5px] font-extrabold text-[#f0b84e]">Driver needed</span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <Link href={`/flights/${travel.id}`} className="block active:scale-[.985] transition-transform">
      {inner}
    </Link>
  );
}
