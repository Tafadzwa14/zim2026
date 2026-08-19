import { notFound } from "next/navigation";
import { getRepo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/identity";
import { fmtDateLong, fmtDayShort, fmtTime, fmtTime24 } from "@/lib/format";
import { FlightCard } from "@/components/flight-card";
import { BackHeader, PersonChip, SectionHeader } from "@/components/ui";
import { FlightStatusAdmin, PickupControl } from "@/components/interactive";

export const dynamic = "force-dynamic";

export default async function FlightDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, me] = await Promise.all([getRepo().getTravel(id), getCurrentUser()]);
  if (!t || !me) return notFound();
  const leg = t.activeLeg;
  if (!leg) return notFound();
  const driver = t.driver;
  const arr = leg.estimated_arrival ?? leg.scheduled_arrival;

  return (
    <div className="mx-auto max-w-xl px-[18px] lg:max-w-3xl lg:px-8">
      <BackHeader title={`${leg.flight_number} · ${leg.airline_name}`} href="/flights" />
      <div className="mt-3">
        <FlightCard travel={t} full />

        <SectionHeader>Arrival</SectionHeader>
        <div className="zc-card p-4">
          <div className="flex items-baseline justify-between">
            <div className="disp text-2xl font-extrabold">{fmtTime(arr)}</div>
            <div className="mono text-xs text-muted">{leg.destination_airport} · {leg.destination_city}</div>
          </div>
          <div className="mt-2 text-sm text-ink2">Scheduled {fmtTime(leg.scheduled_arrival)} {leg.delay_minutes && leg.delay_minutes > 0 ? <>· <b className="text-honey">{leg.delay_minutes} min late</b></> : "· on time"}</div>
          {leg.scheduled_departure && <div className="mono mt-1 text-xs text-muted">{fmtDateLong(leg.scheduled_departure)}</div>}
        </div>

        <SectionHeader meta={String(t.members.length)}>Travelling</SectionHeader>
        <div className="flex flex-wrap gap-2">{t.members.map((m) => <PersonChip key={m.id} user={m} />)}</div>

        {t.pickup?.requested && (
          <>
            <SectionHeader>Pickup</SectionHeader>
            <div className="zc-card flex items-center gap-2.5 p-4">
              <span className="text-xl" aria-hidden>🚗</span>
              <PickupControl travelId={t.id} driver={driver} meId={me.id} isAdmin={me.is_admin} big={!driver} />
            </div>
          </>
        )}

        <SectionHeader>Flight</SectionHeader>
        <div className="zc-card overflow-hidden p-0">
          <Info k="Departed" v={leg.scheduled_departure ? `${fmtDayShort(leg.scheduled_departure)} ${fmtTime(leg.scheduled_departure)}` : "—"} />
          <Info k="Terminal" v={leg.terminal_departure ?? "—"} />
          <Info k="Aircraft" v={leg.aircraft_type ?? "—"} />
        </div>

        <details className="group mt-4">
          <summary className="zc-btn zc-btn-ghost w-full cursor-pointer list-none py-2.5 text-sm">More flight details ✈️</summary>
          <div className="zc-card mt-3 overflow-hidden p-0">
            <Info k="Registration" v={leg.aircraft_registration ?? "—"} mono />
            <Info k="Route" v={`${leg.origin_airport}–${leg.destination_airport}`} mono />
            <Info k="Scheduled dep" v={fmtTime24(leg.scheduled_departure) || "—"} mono />
            <Info k="Est. arrival" v={fmtTime24(arr) || "—"} mono />
            <Info k="Progress" v={`${Math.round((leg.progress ?? 0) * 100)}%`} mono />
          </div>
          <p className="mt-2 px-1 text-xs text-muted">Aviation data shows when the provider supplies it.</p>
        </details>

        {me.is_admin && <div className="mt-4"><FlightStatusAdmin travelId={t.id} legId={leg.id} /></div>}
      </div>
    </div>
  );
}

function Info({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line2 px-4 py-2.5 text-sm last:border-0">
      <span className="font-bold text-muted">{k}</span>
      <span className={`font-extrabold ${mono ? "mono" : ""}`}>{v}</span>
    </div>
  );
}
