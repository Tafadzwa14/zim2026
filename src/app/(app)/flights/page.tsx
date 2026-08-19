import Link from "next/link";
import { getRepo } from "@/lib/repo";
import { tripDateOf, tripTodayISO, fmtDayShortUpper, fmtTime } from "@/lib/format";
import { flightStatusMeta } from "@/lib/display";
import { FlightCard } from "@/components/flight-card";
import { EmptyState, LiveDot, List, Screen, SectionHeader } from "@/components/ui";
import type { TravelView } from "@/lib/repo/types";

export const dynamic = "force-dynamic";

function Row({ t }: { t: TravelView }) {
  const leg = t.activeLeg;
  if (!leg) return null;
  const meta = flightStatusMeta(leg.status);
  const air = leg.status === "air";
  return (
    <Link href={`/flights/${t.id}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-line2 px-4 py-3.5 last:border-0">
      <span className="text-2xl" aria-hidden>{t.members[0]?.emoji ?? "✈️"}</span>
      <span>
        <span className="block text-[15px] font-extrabold">{t.title}</span>
        <span className="mono block text-[10.5px] text-muted">{leg.flight_number} · {leg.origin_airport}→{leg.destination_airport}</span>
      </span>
      <span className="text-right">
        <span className="mono block text-[15px] font-semibold">{leg.status === "scheduled" ? fmtDayShortUpper(t.arrivalIso) : fmtTime(t.arrivalIso)}</span>
        <span className={`mono block text-[9.5px] font-semibold uppercase ${air ? "text-good" : leg.status === "landed" ? "text-[#5f86a8]" : "text-honey"}`}>{air ? "In air" : meta.label}</span>
      </span>
    </Link>
  );
}

export default async function FlightsPage() {
  const travel = await getRepo().listTravel();
  const today = tripTodayISO();
  const air = travel.filter((t) => t.legs.some((l) => l.status === "air"));
  const todayFlights = travel.filter((t) => !air.includes(t) && t.arrivalIso && tripDateOf(t.arrivalIso) === today);
  const upcoming = travel.filter((t) => t.status === "upcoming" && !todayFlights.includes(t));
  const landed = travel.filter((t) => t.status === "arrived");

  return (
    <Screen title="Flights ✈️" sub="Family flight board">
      {travel.length === 0 && <EmptyState emoji="✈️" title="No flights yet" hint="Add travel to start tracking arrivals." />}
      {air.length > 0 && (
        <>
          <SectionHeader meta={<><LiveDot /> live</>}>In the air</SectionHeader>
          <div className="flex flex-col gap-3">{air.map((t) => <FlightCard key={t.id} travel={t} full />)}</div>
        </>
      )}
      {todayFlights.length > 0 && (<><SectionHeader meta={String(todayFlights.length)}>Today</SectionHeader><List>{todayFlights.map((t) => <Row key={t.id} t={t} />)}</List></>)}
      {upcoming.length > 0 && (<><SectionHeader meta={String(upcoming.length)}>Upcoming</SectionHeader><List>{upcoming.map((t) => <Row key={t.id} t={t} />)}</List></>)}
      {landed.length > 0 && (<><SectionHeader meta={String(landed.length)}>Landed</SectionHeader><List>{landed.map((t) => <Row key={t.id} t={t} />)}</List></>)}
    </Screen>
  );
}
