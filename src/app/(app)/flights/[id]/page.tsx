import { notFound } from "next/navigation";
import { cn } from "@/lib/cn";
import { getRepo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/identity";
import { dateIn, durationLabel, fmtDayShort, fmtTimeIn, fmtZoneLabel, minutesBetween, remainingLabel, timeAgo, TRIP_TZ } from "@/lib/format";
import { getArrivalWeather } from "@/lib/weather";
import { FlightCard } from "@/components/flight-card";
import { WorldClocks } from "@/components/world-clocks";
import { ItineraryLeg } from "@/components/itinerary-leg";
import { airportZone } from "@/lib/airports";
import { currentLeg, legArrival, legDeparture, orderedLegs } from "@/lib/travel";
import { airportCity, dualTimeLabel, fmtAirportTime, legRouteLabel, minutesUntil, pickupLeaveBy } from "@/lib/flight-view";
import { flightStatusMeta } from "@/lib/display";
import { BackHeader, PersonChip, SectionHeader } from "@/components/ui";
import { FlightStatusAdmin, PickupControl, RefreshFlight } from "@/components/interactive";
import { FlightEditForm } from "@/components/admin";
import type { TravelView } from "@/lib/repo/types";
import type { FlightLeg, Pickup, PublicUser } from "@/lib/types";

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
  // Arrival day means the calendar day where they land, not in Harare: a 06:30
  // Melbourne landing is still the previous day back home.
  const weather = arr ? await getArrivalWeather(finalLeg.destination_city, dateIn(arr, arrZone)) : null;
  const focusDep = legDeparture(focus);
  const focusArr = legArrival(focus);
  const alerts = flightAlerts(t, focus, finalLeg, driver);

  const title = multi
    ? `${legs[0].origin_airport} → ${finalLeg.destination_airport}`
    : `${focus.flight_number} · ${focus.airline_name}`;

  return (
    <div className="mx-auto max-w-xl px-[18px] lg:max-w-3xl lg:px-8">
      <BackHeader title={title} href="/flights" />
      <div className="mt-3">
        <FlightCard travel={t} full leg={focus} />

        <FlightAlertStrip alerts={alerts} />

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

        {t.pickups.length > 0 && (
          <>
            <SectionHeader meta={t.pickups.length > 1 ? String(t.pickups.length) : undefined}>Pickup</SectionHeader>
            <div className="space-y-3">
              {t.pickups.map((pickup) => {
                const pickupLeg = legs.find((leg) => leg.id === pickup.flight_leg_id);
                if (!pickupLeg) return null;
                const pickupDriver = pickup.driver_user_id ? users.find((u) => u.id === pickup.driver_user_id) ?? null : null;
                return <PickupReadiness key={pickup.id} travel={t} leg={pickupLeg} pickup={pickup} driver={pickupDriver} me={me} drivers={drivers} />;
              })}
            </div>
          </>
        )}

        <SectionHeader>Flight</SectionHeader>
        <div className="zc-card overflow-hidden p-0">
          <Info k="Current leg" v={`${focus.flight_number} · ${legRouteLabel(focus)}`} mono />
          <Info k="Departs" v={focusDep ? `${fmtDayShort(focusDep)} ${dualTimeLabel(focusDep, focus.origin_airport)}` : "TBC"} />
          <Info k="Arrives" v={focusArr ? `${fmtDayShort(focusArr)} ${dualTimeLabel(focusArr, focus.destination_airport)}` : "TBC"} />
          <Info k="Terminal" v={focus.terminal_departure ?? "TBC"} />
          <Info k="Aircraft" v={focus.aircraft_type ?? "TBC"} />
        </div>

        <details className="group mt-4">
          <summary className="zc-btn zc-btn-ghost w-full cursor-pointer list-none py-2.5 text-sm">More flight details ✈️</summary>
          <div className="zc-card mt-3 overflow-hidden p-0">
            <Info k="Registration" v={focus.aircraft_registration ?? "TBC"} mono />
            <Info k="Route" v={`${focus.origin_airport}–${focus.destination_airport}`} mono />
            <Info k="Scheduled dep" v={focus.scheduled_departure ? dualTimeLabel(focus.scheduled_departure, focus.origin_airport) : "TBC"} mono />
            <Info k="Est. arrival" v={focusArr ? dualTimeLabel(focusArr, focus.destination_airport) : "TBC"} mono />
            <Info k="Progress" v={`${Math.round((focus.progress ?? 0) * 100)}%`} mono />
          </div>
          <p className="mt-2 px-1 text-xs text-muted">Aviation data shows when the provider supplies it.</p>
        </details>

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

type FlightAlert = { tone: "good" | "warn" | "info"; title: string; body: string };

function flightAlerts(t: TravelView, leg: FlightLeg, finalLeg: FlightLeg, driver: PublicUser | null): FlightAlert[] {
  const out: FlightAlert[] = [];
  const dep = legDeparture(leg);
  const arr = legArrival(leg);
  const delay = leg.delay_minutes ?? finalLeg.delay_minutes ?? 0;
  const finalArr = legArrival(finalLeg) ?? t.arrivalIso;
  const remaining = leg.status === "air" ? remainingLabel(dep, arr, leg.progress ?? 0) : "";

  if (leg.status === "cancelled" || leg.status === "diverted") {
    out.push({ tone: "warn", title: flightStatusMeta(leg.status).label, body: "Plans need a human check before anyone leaves for the airport." });
  } else if (leg.status === "landed" && finalLeg.status === "landed") {
    out.push({ tone: "good", title: "Landed", body: `${t.title} should be through arrivals soon.` });
  } else if (leg.status === "air") {
    out.push({ tone: "good", title: leg.progress_source === "live" ? "Live radar" : "In the air", body: `${legRouteLabel(leg)}${remaining ? ` · about ${remaining} to go` : ""}.` });
  } else if (leg.status === "boarding") {
    out.push({ tone: "info", title: "Boarding", body: `${leg.flight_number} is the active segment now.` });
  }

  if (delay > 0) out.push({ tone: "warn", title: "Delayed", body: `Running about ${delay} minutes late. Pickup timing should follow the new arrival.` });
  if (t.pickup?.requested && !driver) out.push({ tone: "warn", title: "Driver needed", body: "This airport run is still open for a driver." });
  if (t.pickup?.requested && driver) out.push({ tone: t.pickup.driver_en_route ? "good" : "info", title: t.pickup.driver_en_route ? "Driver en route" : "Pickup claimed", body: `${driver.name} is collecting ${t.title}.` });
  if (finalArr) {
    const mins = minutesUntil(finalArr);
    if (mins !== null && mins > 0 && mins <= 180 && finalLeg.status !== "landed") {
      out.push({ tone: "info", title: "Arriving soon", body: `${dualTimeLabel(finalArr, finalLeg.destination_airport)} final arrival.` });
    }
  }
  if (leg.last_synced_at) {
    const stale = minutesBetween(leg.last_synced_at, new Date().toISOString());
    if (stale !== null && stale > 180 && leg.status !== "landed") out.push({ tone: "info", title: "Refresh suggested", body: "Flight data is a few hours old." });
  }
  return out.slice(0, 4);
}

function FlightAlertStrip({ alerts }: { alerts: FlightAlert[] }) {
  if (!alerts.length) return null;
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {alerts.map((a, i) => (
        <div
          key={`${a.title}-${i}`}
          className={cn(
            "rounded-2xl border px-3.5 py-3",
            a.tone === "good" && "border-[color-mix(in_srgb,var(--good)_28%,var(--line))] bg-[color-mix(in_srgb,var(--good)_10%,var(--card))]",
            a.tone === "warn" && "border-[color-mix(in_srgb,var(--warn)_38%,var(--line))] bg-[color-mix(in_srgb,var(--warn)_12%,var(--card))]",
            a.tone === "info" && "border-line bg-card",
          )}
        >
          <div className={cn("text-[13px] font-extrabold", a.tone === "good" && "text-good", a.tone === "warn" && "text-warn")}>{a.title}</div>
          <div className="mt-0.5 text-xs font-semibold text-ink2">{a.body}</div>
        </div>
      ))}
    </div>
  );
}

function PickupReadiness({ travel, leg, pickup, driver, me, drivers }: { travel: TravelView; leg: FlightLeg; pickup: Pickup; driver: PublicUser | null; me: PublicUser; drivers: PublicUser[] }) {
  const arrival = legArrival(leg) ?? travel.arrivalIso;
  const leaveBy = pickupLeaveBy(arrival);
  const terminal = [leg.terminal_arrival ? `Terminal ${leg.terminal_arrival}` : null, leg.gate_arrival ? `Gate ${leg.gate_arrival}` : null].filter(Boolean).join(" · ");
  const canDrive = me.is_admin || me.roles.includes("driver");
  return (
    <div className="zc-card p-4">
      <div className="grid gap-2 sm:grid-cols-3">
        <PickupMetric label="Landing" value={fmtAirportTime(arrival, leg.destination_airport)} sub={dualTimeLabel(arrival, leg.destination_airport)} />
        <PickupMetric label="Driver target" value={leaveBy ? fmtAirportTime(leaveBy, leg.destination_airport) : "TBC"} sub="75 min before landing" />
        <PickupMetric label="Where" value={leg.destination_airport} sub={terminal || airportCity(leg.destination_airport, leg.destination_city)} />
      </div>
      {(leg.delay_minutes ?? 0) > 0 && <div className="mt-3 rounded-xl bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] px-3 py-2 text-xs font-bold text-warn">Flight is {leg.delay_minutes} min late. The driver target follows the updated landing time.</div>}
      <div className="mt-4 flex items-center gap-2.5 border-t border-line2 pt-3">
        <span className="text-xl" aria-hidden>🚗</span>
        <PickupControl pickupId={pickup.id} driver={driver} meId={me.id} isAdmin={me.is_admin} canDrive={canDrive} drivers={drivers} big={!driver} enRoute={pickup.driver_en_route} />
      </div>
    </div>
  );
}

function PickupMetric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-chip px-3 py-2.5">
      <div className="mono text-[10px] font-bold uppercase text-muted">{label}</div>
      <div className="mt-0.5 text-[15px] font-extrabold">{value || "TBC"}</div>
      {sub && <div className="mono mt-0.5 text-[10.5px] text-muted">{sub}</div>}
    </div>
  );
}

function Info({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line2 px-4 py-2.5 text-sm last:border-0">
      <span className="font-bold text-muted">{k}</span>
      <span className={cn("font-extrabold", mono && "mono")}>{v}</span>
    </div>
  );
}
