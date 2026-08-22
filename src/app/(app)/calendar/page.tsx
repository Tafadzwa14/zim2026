import { getRepo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/identity";
import { categoryOf, GOGO_BIRTHDAY, WEDDING_TIME } from "@/lib/display";
import { fmtTime24, fmtTimeIn, fmtZoneLabel, tripDateOf, tripTodayISO, TRIP_TZ } from "@/lib/format";
import { airportRunsFor, HARARE, legArrival, legDeparture, orderedLegs, pickupForLeg } from "@/lib/travel";
import { airportZone } from "@/lib/airports";
import { Screen } from "@/components/ui";
import { CalendarView, type CalEvent } from "@/components/calendar-view";

export const dynamic = "force-dynamic";

/**
 * The clock time at the airport itself, with its zone, e.g. "17:45 AEST".
 * Undefined when the airport already runs on trip time or we don't know its
 * zone, so those rows keep the plain trip-time reading and gain no useless
 * label. Only the display changes: the event still sits on its trip-time date.
 */
function airportClock(iso: string, iata: string): string | undefined {
  const tz = airportZone(iata);
  if (!tz || tz === TRIP_TZ) return undefined;
  const zone = fmtZoneLabel(iso, tz);
  return `${fmtTimeIn(iso, tz)}${zone ? ` ${zone}` : ""}`;
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const initialView = view === "month" || view === "plans" ? view : "agenda";
  const repo = getRepo();
  const [plans, travel, settings, users, places, me] = await Promise.all([
    repo.listPlans(),
    repo.listTravel(),
    repo.getSettings(),
    repo.listUsers(),
    repo.listPlaces(),
    getCurrentUser(),
  ]);
  if (!me) return null;

  const evs: CalEvent[] = [];

  plans.forEach((p) =>
    evs.push({
      id: `plan-${p.id}`,
      kind: "plan",
      date: p.date,
      time: p.start_time,
      icon: categoryOf(p.category).icon,
      title: p.title,
      href: `/plans/${p.id}`,
      planId: p.id,
      anyoneCanJoin: p.anyone_can_join,
      attendeeEmojis: p.attendees.map((a) => a.emoji),
      attendeeIds: p.attendees.map((a) => a.id),
    })
  );

  // A trip is usually the whole return journey in one group, with Harare in the
  // middle, so a single event built from the final arrival lands on the day they
  // get home and reads as though they were arriving. Each real moment gets its
  // own entry instead: flying out, every Harare arrival and departure, and
  // landing back home.
  travel.forEach((t) => {
    const legs = orderedLegs(t);
    if (!legs.length) return;
    const href = `/flights/${t.id}`;
    const finalLeg = legs[legs.length - 1];

    const out = legDeparture(legs[0]);
    if (out && legs[0].origin_airport.trim().toUpperCase() !== HARARE) {
      evs.push({
        id: `depart-${t.id}`, kind: "travel", date: tripDateOf(out), time: fmtTime24(out),
        displayTime: airportClock(out, legs[0].origin_airport),
        icon: "🛫", title: `${t.title} fly out`, href,
      });
    }

    for (const run of airportRunsFor(t)) {
      const arriving = run.kind === "pickup";
      const date = tripDateOf(run.hreIso);
      const time = fmtTime24(run.hreIso);
      evs.push({
        id: `run-${run.id}`,
        kind: "travel",
        date,
        time,
        icon: arriving ? "🛬" : "🛫",
        title: `${t.title} ${arriving ? "arrive in Harare" : "leave Harare"}${run.cancelled ? " (cancelled)" : ""}`,
        href,
      });
      if (arriving && !run.cancelled && pickupForLeg(t, run.leg.id)) {
        evs.push({ id: `pickup-${run.id}`, kind: "pickup", date, time, icon: "🚗", title: `Airport pickup, ${t.title}`, href });
      }
    }

    // Only when the journey ends somewhere other than Harare, so a one-way trip
    // into Harare isn't listed twice.
    const home = legArrival(finalLeg);
    if (home && finalLeg.destination_airport.trim().toUpperCase() !== HARARE) {
      evs.push({
        id: `home-${t.id}`, kind: "travel", date: tripDateOf(home), time: fmtTime24(home),
        displayTime: airportClock(home, finalLeg.destination_airport),
        icon: "🏠", title: `${t.title} land back home`, href,
      });
    }
  });

  evs.push({ id: "wedding", kind: "wedding", date: settings.wedding_date, time: WEDDING_TIME, icon: "💍", title: "Wedding / Roora" });
  evs.push({ id: "birthday", kind: "birthday", date: GOGO_BIRTHDAY.date, time: GOGO_BIRTHDAY.time, icon: GOGO_BIRTHDAY.icon, title: GOGO_BIRTHDAY.title });
  evs.sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));

  return (
    <Screen title="Calendar 📅">
      <CalendarView
        events={evs}
        plans={plans}
        me={me}
        users={users}
        places={places}
        today={tripTodayISO()}
        wedding={{ date: settings.wedding_date, url: settings.wedding_url }}
        initialView={initialView}
      />
    </Screen>
  );
}
