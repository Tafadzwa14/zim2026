import { notFound } from "next/navigation";
import { getRepo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/identity";
import { fmtDateLong, fmtDayShort, fmtTime, timeAgo, tripDateOf } from "@/lib/format";
import { flightStatusMeta } from "@/lib/display";
import { getArrivalWeather } from "@/lib/weather";
import { FlightCard } from "@/components/flight-card";
import { WorldClocks } from "@/components/world-clocks";
import { airportZone } from "@/lib/airports";
import { BackHeader, PersonChip, SectionHeader } from "@/components/ui";
import { FlightStatusAdmin, PickupControl, RefreshFlight } from "@/components/interactive";
import { FlightEditForm } from "@/components/admin";
import type { FlightLeg } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Minutes between two ISO instants, or null if either is missing. */
function minutesBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const mins = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000);
  return Number.isFinite(mins) ? mins : null;
}

function durLabel(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

export default async function FlightDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, me, users] = await Promise.all([getRepo().getTravel(id), getCurrentUser(), getRepo().listUsers()]);
  if (!t || !me) return notFound();
  const drivers = users.filter((u) => u.is_admin || u.roles.includes("driver"));
  const active = t.activeLeg;
  if (!active) return notFound();
  const legs = t.legs.length ? t.legs : [active];
  const finalLeg = legs[legs.length - 1];
  const multi = legs.length > 1;
  const driver = t.driver;
  // Arrival = the journey's final destination, not whichever leg is active now.
  const arr = finalLeg.estimated_arrival ?? finalLeg.scheduled_arrival;

  // "Current airport" for the world clocks: where the traveller is (or is
  // heading). Origin while waiting/boarding, destination once airborne or landed.
  const atArrivalEnd = active.status === "air" || active.status === "landed";
  const clockAirport = atArrivalEnd ? active.destination_airport : active.origin_airport;
  const clockCity = atArrivalEnd ? active.destination_city : active.origin_city;
  const clockLabel = active.status === "air" ? `Arriving ${clockAirport}` : clockAirport;
  const weather = arr ? await getArrivalWeather(finalLeg.destination_city, tripDateOf(arr)) : null;

  const title = multi
    ? `${legs[0].origin_airport} → ${finalLeg.destination_airport}`
    : `${active.flight_number} · ${active.airline_name}`;

  return (
    <div className="mx-auto max-w-xl px-[18px] lg:max-w-3xl lg:px-8">
      <BackHeader title={title} href="/flights" />
      <div className="mt-3">
        <FlightCard travel={t} full />

        <WorldClocks
          airportZone={airportZone(clockAirport) ?? null}
          airportLabel={clockLabel}
          airportSub={clockCity}
        />

        <div className="mt-3 flex items-center justify-between">
          <span className="mono text-[11px] text-muted">Updated {timeAgo(active.last_synced_at ?? new Date().toISOString())}</span>
          <RefreshFlight travelId={t.id} />
        </div>

        <SectionHeader meta={multi ? `${legs.length} flights` : undefined}>Itinerary</SectionHeader>
        <div className="flex flex-col gap-2.5">
          {legs.map((leg, i) => {
            const layover = i > 0 ? minutesBetween(legs[i - 1].scheduled_arrival, leg.scheduled_departure) : null;
            return (
              <div key={leg.id}>
                {layover != null && layover > 0 && (
                  <div className="mono mb-2.5 flex items-center gap-2 px-1 text-[11px] font-semibold text-muted">
                    <span className="h-px flex-1 bg-line" />
                    🕓 {durLabel(layover)} layover in {leg.origin_city} ({leg.origin_airport})
                    <span className="h-px flex-1 bg-line" />
                  </div>
                )}
                <ItineraryLeg leg={leg} index={i} total={legs.length} active={leg.id === active.id && multi} />
              </div>
            );
          })}
        </div>

        <SectionHeader>Arrival</SectionHeader>
        <div className="zc-card p-4">
          <div className="flex items-baseline justify-between">
            <div className="disp text-2xl font-extrabold">{fmtTime(arr)}</div>
            <div className="mono text-xs text-muted">{finalLeg.destination_airport} · {finalLeg.destination_city}</div>
          </div>
          <div className="mt-2 text-sm text-ink2">Scheduled {fmtTime(finalLeg.scheduled_arrival)} {finalLeg.delay_minutes && finalLeg.delay_minutes > 0 ? <>· <b className="text-honey">{finalLeg.delay_minutes} min late</b></> : "· on time"}</div>
          {finalLeg.scheduled_arrival && <div className="mono mt-1 text-xs text-muted">{fmtDateLong(finalLeg.scheduled_arrival)}</div>}
        </div>

        {weather && (
          <div className="zc-card mt-3 flex items-center gap-3.5 p-4">
            <span className="text-3xl" aria-hidden>{weather.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-extrabold">{weather.city} on arrival day</div>
              <div className="text-xs font-semibold text-muted">{weather.label} · {weather.min}°–{weather.max}°</div>
            </div>
          </div>
        )}

        <SectionHeader meta={String(t.members.length)}>Travelling</SectionHeader>
        <div className="flex flex-wrap gap-2">{t.members.map((m) => <PersonChip key={m.id} user={m} />)}</div>

        {t.pickup?.requested && (
          <>
            <SectionHeader>Pickup</SectionHeader>
            <div className="zc-card flex items-center gap-2.5 p-4">
              <span className="text-xl" aria-hidden>🚗</span>
              <PickupControl travelId={t.id} driver={driver} meId={me.id} isAdmin={me.is_admin} canDrive={me.is_admin || me.roles.includes("driver")} drivers={drivers} big={!driver} enRoute={t.pickup?.driver_en_route} />
            </div>
          </>
        )}

        {me.is_admin && (
          <>
            <SectionHeader>Admin · edit flights</SectionHeader>
            <div className="space-y-4">
              {legs.map((leg) => (
                <div key={leg.id} className="space-y-3">
                  {multi && <div className="mono px-1 text-[11px] font-bold uppercase tracking-wide text-muted">{leg.flight_number} · {leg.origin_airport}→{leg.destination_airport}</div>}
                  <FlightStatusAdmin travelId={t.id} legId={leg.id} />
                  <FlightEditForm leg={leg} />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** One segment of the journey, shown as a self-contained card. */
function ItineraryLeg({ leg, index, total, active }: { leg: FlightLeg; index: number; total: number; active: boolean }) {
  const meta = flightStatusMeta(leg.status);
  const dep = leg.estimated_departure ?? leg.scheduled_departure;
  const arr = leg.estimated_arrival ?? leg.scheduled_arrival;
  const late = leg.status !== "landed" && (leg.delay_minutes ?? 0) > 0;
  const tone =
    meta.tone === "air" ? "text-good" : meta.tone === "land" ? "text-[#5f86a8]" : meta.tone === "cancel" ? "text-berry" : "text-honey";
  return (
    <div className={`zc-card p-4 ${active ? "border-[1.5px] border-honey" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="mono rounded-md bg-chip px-1.5 py-0.5 text-[10px] font-bold text-muted">{total > 1 ? `Leg ${index + 1}` : "Flight"}</span>
          <span className="mono text-[14px] font-semibold">{leg.flight_number}</span>
          <span className="text-[11px] font-bold uppercase tracking-wide text-muted">{leg.airline_name}</span>
        </div>
        <span className={`mono text-[10px] font-semibold uppercase ${active ? "text-good" : tone}`}>{leg.status === "air" ? "In air" : meta.label}{late ? ` · ${leg.delay_minutes}m late` : ""}</span>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div>
          <div className="mono text-[22px] font-semibold leading-none">{leg.origin_airport}</div>
          <div className="mt-1 text-[11px] font-bold text-muted">{leg.origin_city}</div>
          <div className="mono mt-1 text-[12px] font-semibold">{fmtTime(dep)}</div>
          <div className="mono text-[10px] text-muted">{fmtDayShort(dep)}</div>
        </div>
        <span className="text-lg text-muted" aria-hidden>✈</span>
        <div className="text-right">
          <div className="mono text-[22px] font-semibold leading-none">{leg.destination_airport}</div>
          <div className="mt-1 text-[11px] font-bold text-muted">{leg.destination_city}</div>
          <div className="mono mt-1 text-[12px] font-semibold">{fmtTime(arr)}</div>
          <div className="mono text-[10px] text-muted">{fmtDayShort(arr)}</div>
        </div>
      </div>
      {(leg.terminal_departure || leg.aircraft_type) && (
        <div className="mono mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-line2 pt-2.5 text-[11px] text-muted">
          {leg.terminal_departure && <span>Terminal {leg.terminal_departure}</span>}
          {leg.aircraft_type && <span>{leg.aircraft_type}</span>}
        </div>
      )}
    </div>
  );
}
