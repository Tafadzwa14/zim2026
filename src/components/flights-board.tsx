"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { flightStatusMeta } from "@/lib/display";
import { fmtDayShortUpper, tripDateOf, tripTodayISO } from "@/lib/format";
import { airportRunsFor, pickupForLeg, type AirportRun } from "@/lib/travel";
import {
  currentLeg,
  dualTimeLabel,
  finalLeg,
  fmtAirportTime,
  legArrival,
  legDeparture,
  pickupLeaveBy,
  tripRouteLabel,
} from "@/lib/flight-view";
import { FlightCard } from "@/components/flight-card";
import { PickupControl } from "@/components/interactive";
import { PlaneFacts } from "@/components/plane-facts";
import { CatPill, EmptyState, List, LiveDot, SectionHeader } from "@/components/ui";
import type { TravelView } from "@/lib/repo/types";
import type { PublicUser } from "@/lib/types";

type BoardFilter = "all" | "today" | "air" | "pickups";

function touchesDate(t: TravelView, date: string): boolean {
  return t.legs.some((leg) => {
    const departure = legDeparture(leg);
    const arrival = legArrival(leg);
    return (departure ? tripDateOf(departure) === date : false) || (arrival ? tripDateOf(arrival) === date : false);
  });
}

function Row({ t }: { t: TravelView }) {
  const leg = currentLeg(t);
  const last = finalLeg(t);
  if (!leg) return null;
  const meta = flightStatusMeta(leg.status);
  const air = leg.status === "air";
  const late = leg.status !== "landed" && (leg.delay_minutes ?? 0) > 0;
  const arrival = legArrival(last) ?? t.arrivalIso;
  const route = tripRouteLabel(t);
  const legNote = t.legs.length > 1 ? `${leg.flight_number} now · ${leg.origin_airport}→${leg.destination_airport}` : `${leg.flight_number} · ${route}`;

  return (
    <Link href={`/flights/${t.id}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-line2 px-4 py-3.5 last:border-0">
      <span className="text-2xl" aria-hidden>{t.members[0]?.emoji ?? "✈️"}</span>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-extrabold">{t.title}</span>
        <span className="mono block truncate text-[10.5px] text-muted">{route} · {legNote}</span>
      </span>
      <span className="text-right">
        <span className="mono block text-[15px] font-semibold">{leg.status === "scheduled" ? fmtDayShortUpper(arrival) : fmtAirportTime(arrival, last?.destination_airport)}</span>
        <span className={cn("mono block text-[9.5px] font-semibold uppercase", air ? "text-good" : leg.status === "landed" ? "text-[#5f86a8]" : late ? "text-warn" : "text-honey")}>
          {air ? "In air" : meta.label}{late ? ` · ${leg.delay_minutes}m late` : ""}
        </span>
      </span>
    </Link>
  );
}

function PickupCard({ run, me, users }: { run: AirportRun; me: PublicUser; users: PublicUser[] }) {
  const t = run.trip;
  const leg = run.leg;
  const pickup = pickupForLeg(t, leg.id);
  if (!pickup) return null;
  const arrival = legArrival(leg) ?? run.hreIso;
  const driver = pickup.driver_user_id ? users.find((u) => u.id === pickup.driver_user_id) ?? null : null;
  const drivers = users.filter((u) => u.is_admin || u.roles.includes("driver"));
  const leaveBy = pickupLeaveBy(arrival);
  const delayed = (leg?.delay_minutes ?? 0) > 0;

  return (
    <div className={cn("zc-card p-4", !driver && "border-[color-mix(in_srgb,var(--warn)_42%,var(--line))]")}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="mono min-w-0 font-semibold">{fmtDayShortUpper(arrival)} · {fmtAirportTime(arrival, leg?.destination_airport)}</div>
        {leg && <CatPill icon="✈️" label={leg.flight_number} />}
      </div>
      <div className="disp my-2 text-lg font-extrabold">{t.members.map((m) => m.emoji).join(" ")} {t.title}</div>
      {leg && <div className="mono text-[11px] text-muted">{leg.origin_city} → {leg.destination_city} · {dualTimeLabel(arrival, leg.destination_airport)}</div>}
      <div className="mt-3 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-xl bg-chip px-2 py-2">
          <div className="mono text-[11px] font-bold text-muted">Target</div>
          <div className="text-sm font-extrabold">{leaveBy ? fmtAirportTime(leaveBy, leg?.destination_airport) : "TBC"}</div>
        </div>
        <div className="rounded-xl bg-chip px-2 py-2">
          <div className="mono text-[11px] font-bold text-muted">Status</div>
          <div className={cn("text-sm font-extrabold", driver ? "text-good" : "text-warn")}>{driver ? (pickup.driver_en_route ? "On the way" : "Claimed") : "Driver needed"}</div>
        </div>
      </div>
      {delayed && <div className="mt-2 rounded-xl bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] px-3 py-2 text-xs font-bold text-warn">Flight delayed {leg?.delay_minutes} min. Driver can wait before leaving.</div>}
      <div className="mt-3">
        <PickupControl pickupId={pickup.id} driver={driver} meId={me.id} isAdmin={me.is_admin} canDrive={me.is_admin || me.roles.includes("driver")} drivers={drivers} big={!driver} enRoute={pickup.driver_en_route} />
      </div>
    </div>
  );
}

function FlightSection({ title, items, meta, fullCards = false }: { title: string; items: TravelView[]; meta?: ReactNode; fullCards?: boolean }) {
  if (!items.length) return null;
  return (
    <>
      <SectionHeader meta={meta ?? String(items.length)}>{title}</SectionHeader>
      {fullCards ? <div className="flex flex-col gap-3">{items.map((t) => <FlightCard key={t.id} travel={t} full />)}</div> : <List>{items.map((t) => <Row key={t.id} t={t} />)}</List>}
    </>
  );
}

export function FlightsBoard({ travel, me, users }: { travel: TravelView[]; me: PublicUser; users: PublicUser[] }) {
  const [filter, setFilter] = useState<BoardFilter>("all");

  const groups = useMemo(() => {
    const today = tripTodayISO();
    const air = travel.filter((t) => t.legs.some((l) => l.status === "air"));
    const todayFlights = travel.filter((t) => !air.includes(t) && touchesDate(t, today));
    const upcoming = travel.filter((t) => t.status === "upcoming" && !todayFlights.includes(t));
    const landed = travel.filter((t) => t.status === "arrived");
    const runs = travel.flatMap((t) => t.status === "arrived" ? [] : airportRunsFor(t).filter((r) => r.kind === "pickup" && pickupForLeg(t, r.leg.id)));
    return { air, todayFlights, upcoming, landed, runs };
  }, [travel]);

  const filters: { key: BoardFilter; label: string; n: number }[] = [
    { key: "all", label: "All", n: travel.length },
    { key: "today", label: "Today", n: groups.todayFlights.length + groups.air.filter((t) => touchesDate(t, tripTodayISO())).length },
    { key: "air", label: "In air", n: groups.air.length },
    { key: "pickups", label: "Pickups", n: groups.runs.length },
  ];

  const showRuns = filter === "all" || filter === "pickups";
  const showAir = filter === "all" || filter === "air" || filter === "today";
  const showToday = filter === "all" || filter === "today";
  const showUpcoming = filter === "all";
  const showLanded = filter === "all";
  const showAirFacts = showAir && groups.air.length === 0;
  const empty =
    (filter === "today" && !groups.todayFlights.length && !groups.air.length) ||
    (filter === "pickups" && !groups.runs.length);

  return (
    <div>
      <div role="tablist" aria-label="Filter flights" className="mb-4 grid grid-cols-4 gap-1 rounded-xl border border-line bg-card p-1">
        {filters.map((f) => (
          <button
            key={f.key}
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={cn("min-w-0 rounded-lg px-2 py-1.5 text-[12px] font-extrabold transition-colors sm:text-[13px]", filter === f.key ? "bg-honey text-white" : "text-muted")}
          >
            <span className="truncate">{f.label}</span>
            <span className={cn("mono ml-1 text-[10.5px]", filter === f.key ? "text-white/80" : "text-muted")}>{f.n}</span>
          </button>
        ))}
      </div>

      {empty && <EmptyState emoji={filter === "pickups" ? "🚗" : "✈️"} title={filter === "pickups" ? "No airport runs" : "Nothing in this view"} hint="Switch filters to see the rest of the board." />}

      {showRuns && groups.runs.length > 0 && (
        <>
          <SectionHeader meta={String(groups.runs.length)}>Airport runs 🚗</SectionHeader>
          <div className="grid gap-3 md:grid-cols-2">{groups.runs.map((run) => <PickupCard key={run.id} run={run} me={me} users={users} />)}</div>
        </>
      )}

      {showAirFacts && (
        <>
          <SectionHeader meta="0 active">In the air</SectionHeader>
          <PlaneFacts />
        </>
      )}
      {showAir && groups.air.length > 0 && <FlightSection title="In the air" items={groups.air} fullCards meta={<><LiveDot /> live</>} />}
      {showToday && <FlightSection title="Today" items={groups.todayFlights} />}
      {showUpcoming && <FlightSection title="Upcoming" items={groups.upcoming} />}
      {showLanded && <FlightSection title="Landed" items={groups.landed} />}
    </div>
  );
}
