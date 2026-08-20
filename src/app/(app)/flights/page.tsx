import Link from "next/link";
import { getRepo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/identity";
import { tripDateOf, tripTodayISO, fmtDayShortUpper, fmtTime } from "@/lib/format";
import { flightStatusMeta } from "@/lib/display";
import { FlightCard } from "@/components/flight-card";
import { CatPill, LiveDot, List, Screen, SectionHeader } from "@/components/ui";
import { PickupControl } from "@/components/interactive";
import { PlaneFacts } from "@/components/plane-facts";
import type { TravelView } from "@/lib/repo/types";
import type { PublicUser } from "@/lib/types";

function Row({ t }: { t: TravelView }) {
  const leg = t.activeLeg;
  if (!leg) return null;
  const meta = flightStatusMeta(leg.status);
  const air = leg.status === "air";
  const late = leg.status !== "landed" && (leg.delay_minutes ?? 0) > 0;
  return (
    <Link href={`/flights/${t.id}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-line2 px-4 py-3.5 last:border-0">
      <span className="text-2xl" aria-hidden>{t.members[0]?.emoji ?? "✈️"}</span>
      <span>
        <span className="block text-[15px] font-extrabold">{t.title}</span>
        <span className="mono block text-[10.5px] text-muted">{leg.flight_number} · {leg.origin_airport}→{leg.destination_airport}</span>
      </span>
      <span className="text-right">
        <span className="mono block text-[15px] font-semibold">{leg.status === "scheduled" ? fmtDayShortUpper(t.arrivalIso) : fmtTime(t.arrivalIso)}</span>
        <span className={`mono block text-[9.5px] font-semibold uppercase ${air ? "text-good" : leg.status === "landed" ? "text-[#5f86a8]" : late ? "text-warn" : "text-honey"}`}>{air ? "In air" : meta.label}{late ? ` · ${leg.delay_minutes}m late` : ""}</span>
      </span>
    </Link>
  );
}

function PickupCard({ t, me, users }: { t: TravelView; me: PublicUser; users: PublicUser[] }) {
  const leg = t.activeLeg;
  const driver = t.pickup?.driver_user_id ? users.find((u) => u.id === t.pickup?.driver_user_id) ?? null : null;
  return (
    <div className="zc-card p-4">
      <div className="flex items-baseline justify-between">
        <div className="mono font-semibold">{fmtDayShortUpper(t.arrivalIso)} · {fmtTime(t.arrivalIso)}</div>
        {leg && <CatPill icon="✈️" label={leg.flight_number} />}
      </div>
      <div className="disp my-2 text-lg font-extrabold">{t.members.map((m) => m.emoji).join(" ")} {t.title}</div>
      {leg && <div className="mono text-[11px] text-muted">{leg.origin_city} → {leg.destination_city}</div>}
      <div className="mt-3"><PickupControl travelId={t.id} driver={driver} meId={me.id} isAdmin={me.is_admin} big={!driver} enRoute={t.pickup?.driver_en_route} /></div>
    </div>
  );
}

export default async function FlightsPage() {
  const [travel, me, users] = await Promise.all([getRepo().listTravel(), getCurrentUser(), getRepo().listUsers()]);
  if (!me) return null;
  const today = tripTodayISO();
  const air = travel.filter((t) => t.legs.some((l) => l.status === "air"));
  const todayFlights = travel.filter((t) => !air.includes(t) && t.arrivalIso && tripDateOf(t.arrivalIso) === today);
  const upcoming = travel.filter((t) => t.status === "upcoming" && !todayFlights.includes(t));
  const landed = travel.filter((t) => t.status === "arrived");
  const runs = travel.filter((t) => t.pickup?.requested && t.status !== "arrived");

  return (
    <Screen title="Flights ✈️" sub="Flight board and airport runs">
      {travel.length === 0 && <PlaneFacts />}

      {runs.length > 0 && (
        <>
          <SectionHeader meta={String(runs.length)}>Airport runs 🚗</SectionHeader>
          <div className="grid gap-3 md:grid-cols-2">{runs.map((t) => <PickupCard key={t.id} t={t} me={me} users={users} />)}</div>
        </>
      )}

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
