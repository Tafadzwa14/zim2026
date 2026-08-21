import { notFound } from "next/navigation";
import { getRepo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/identity";
import { dateIn, durationLabel, fmtTimeIn, fmtZoneLabel, minutesBetween, timeAgo, TRIP_TZ } from "@/lib/format";
import { getArrivalWeather } from "@/lib/weather";
import { FlightCard } from "@/components/flight-card";
import { WorldClocks } from "@/components/world-clocks";
import { ItineraryLeg } from "@/components/itinerary-leg";
import { airportZone } from "@/lib/airports";
import { currentLeg, legArrival, legDeparture, orderedLegs } from "@/lib/travel";
import { BackHeader, PersonChip, SectionHeader } from "@/components/ui";
import { FlightStatusAdmin, PickupControl, RefreshFlight } from "@/components/interactive";
import { FlightEditForm } from "@/components/admin";

export const dynamic = "force-dynamic";

/** Weekday and date for an instant in a given zone, e.g. `Thursday 24 September`. */
function dayLongIn(iso: string, tz?: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz ?? TRIP_TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}

export default async function FlightDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, me, users] = await Promise.all([getRepo().getTravel(id), getCurrentUser(), getRepo().listUsers()]);
  if (!t || !me) return notFound();
  const drivers = users.filter((u) => u.is_admin || u.roles.includes("driver"));
  const legs = orderedLegs(t);
  if (!legs.length) return notFound();
  // The leg they're on right now, and the leg the page speaks from: once every
  // leg has landed there's no current one, so fall back to the last.
  const cur = currentLeg(legs);
  const finalLeg = legs[legs.length - 1];
  const focus = cur ?? finalLeg;
  const multi = legs.length > 1;
  const driver = t.driver;
  // Arrival = the journey's final destination, not whichever leg is active now,
  // and the best-known instant so a leg that landed early reads the same here
  // as it does on its itinerary card.
  const arr = legArrival(finalLeg);
  // Read the arrival in the destination airport's own zone, like the itinerary
  // cards do. An airport we don't hold falls back to trip time, said plainly.
  const arrZone = airportZone(finalLeg.destination_airport);
  const arrZoneLabel = fmtZoneLabel(arr, arrZone);
  const arrZoneNote = arrZone ? `${finalLeg.destination_airport} local time` : "trip time";

  // "Current airport" for the world clocks: where the traveller is (or is
  // heading). Origin while waiting/boarding, destination once airborne or landed.
  const atArrivalEnd = focus.status === "air" || focus.status === "landed";
  const clockAirport = atArrivalEnd ? focus.destination_airport : focus.origin_airport;
  const clockCity = atArrivalEnd ? focus.destination_city : focus.origin_city;
  const clockLabel = focus.status === "air" ? `Arriving ${clockAirport}` : clockAirport;
  // Arrival day means the calendar day where they land, not in Harare: a 6:30 AM
  // Melbourne landing is still the previous day back home.
  const weather = arr ? await getArrivalWeather(finalLeg.destination_city, dateIn(arr, arrZone)) : null;

  const title = multi
    ? `${legs[0].origin_airport} → ${finalLeg.destination_airport}`
    : `${focus.flight_number} · ${focus.airline_name}`;

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
          <span className="mono text-[11px] text-muted">Updated {timeAgo(focus.last_synced_at ?? new Date().toISOString())}</span>
          <RefreshFlight travelId={t.id} />
        </div>

        <SectionHeader meta={multi ? `${legs.length} flights` : undefined}>Itinerary</SectionHeader>
        <div className="flex flex-col gap-2.5">
          {legs.map((leg, i) => {
            const previous = i > 0 ? legs[i - 1] : null;
            // Ground time from the best-known arrival to the best-known departure,
            // so an estimate or an actual time moves the layover with it.
            const layover = previous ? minutesBetween(legArrival(previous), legDeparture(leg)) : null;
            return (
              <div key={leg.id}>
                {layover != null && layover > 0 && (
                  <div className="mono mb-2.5 flex items-center gap-2 px-1 text-[11px] font-semibold text-muted">
                    <span className="h-px flex-1 bg-line" />
                    🕓 {durationLabel(layover)} layover in {leg.origin_city} ({leg.origin_airport})
                    <span className="h-px flex-1 bg-line" />
                  </div>
                )}
                <ItineraryLeg leg={leg} index={i} total={legs.length} current={multi && leg.id === cur?.id} previous={previous} layoverMins={layover} />
              </div>
            );
          })}
        </div>

        <SectionHeader>Arrival</SectionHeader>
        <div className="zc-card p-4">
          <div className="flex items-baseline justify-between">
            <div className="flex items-baseline gap-1.5">
              <div className="disp text-2xl font-extrabold">{fmtTimeIn(arr, arrZone) || "TBC"}</div>
              {arrZoneLabel && <span className="mono text-[11px] font-semibold text-muted">{arrZoneLabel}</span>}
            </div>
            <div className="mono text-xs text-muted">{finalLeg.destination_airport} · {finalLeg.destination_city}</div>
          </div>
          <div className="mt-2 text-sm text-ink2">Scheduled {fmtTimeIn(finalLeg.scheduled_arrival, arrZone) || "TBC"} {fmtZoneLabel(finalLeg.scheduled_arrival, arrZone)} {finalLeg.delay_minutes && finalLeg.delay_minutes > 0 ? <>· <b className="text-honey">{finalLeg.delay_minutes} min late</b></> : "· on time"}</div>
          {arr && <div className="mono mt-1 text-xs text-muted">{dayLongIn(arr, arrZone)} · {arrZoneNote}</div>}
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
