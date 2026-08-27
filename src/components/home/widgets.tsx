import Link from "next/link";
import type { ReactNode } from "react";
import { airportZone } from "@/lib/airports";
import { cn } from "@/lib/cn";
import type { Dashboard } from "@/lib/dashboard";
import { categoryOf, flightStatusMeta, GOGO_BIRTHDAY, WEDDING_TIME } from "@/lib/display";
import { durationLabel, fmtDayShortIn, fmtDayShortUpper, fmtTime, fmtTime24, fmtTimeIn, fmtZoneLabel, minutesBetween, timeAgo, tripDateOf, tripInstant } from "@/lib/format";
import { currentLeg, legArrival, legDeparture, orderedLegs, pickupForLeg, type AirportRun, type AirportRunKind } from "@/lib/travel";
import { FlightCard } from "@/components/flight-card";
import { List, LiveDot, SectionHeader } from "@/components/ui";
import { PickupControl, ShoppingItemRow, TaskItemRow } from "@/components/interactive";
import { PlaneFacts } from "@/components/plane-facts";
import { PhotoCarousel } from "@/components/photo-gallery";
import { Dismissable } from "@/components/dismissable";
import { ViewerTime } from "@/components/viewer-time";
import type { PhotoView, TravelView } from "@/lib/repo/types";
import type { FlightLeg, PublicUser } from "@/lib/types";

/**
 * Everything a widget needs to render, computed once by the home page and
 * passed down. Keeping the derived values here (rather than recomputing per
 * widget) means the render maps below stay cheap and synchronous.
 */
export interface HomeCtx {
  d: Dashboard;
  me: PublicUser;
  /** Every group with a leg in the air right now; more than one can be. */
  activeFlights: TravelView[];
  /** The viewer's own trip while it still has a leg to fly, else null. */
  myFlight: TravelView | null;
  /** The viewer's open tasks, already sorted soonest due first. */
  myTasks: Dashboard["tasks"];
  todayPlans: Dashboard["plans"];
  comingUp: { date: string; icon: string; title: string; href: string }[];
  infoSummary: { category: string; icon: string }[];
  photos: PhotoView[];
}

interface CalEv { icon: string; title: string; date: string; time: string | null; href: string }

/** How each direction of airport run reads: the label and its emoji. */
const RUN_META: Record<AirportRunKind, { label: string; emoji: string }> = {
  pickup: { label: "Pickup", emoji: "🛬" },
  dropoff: { label: "Drop-off", emoji: "🛫" },
};

/** The travellers' emojis for a trip, falling back to a plane for an empty group. */
function crew(t: TravelView): string {
  return t.members.map((m) => m.emoji).join(" ") || "✈️";
}

/**
 * The run to lead with on a banner or stat tile: the soonest live one. A
 * cancelled run only gets the spot when that is genuinely all there is, and
 * whatever reads this must then say cancelled rather than imply a car is going.
 */
function heroRun(d: Dashboard): AirportRun | null {
  return d.runsAhead.find((r) => !r.cancelled) ?? d.runsAhead[0] ?? null;
}

function runTimeSummary(run: AirportRun): string {
  if (run.kind === "dropoff") {
    const departs = fmtTime(legDeparture(run.leg));
    return ["check-in " + fmtTime(run.hreIso), departs ? `departs ${departs}` : null].filter(Boolean).join(" · ");
  }
  return `lands ${fmtTime(run.hreIso)}`;
}

/** The leg a trip has in the air right now, if any. `activeLeg` can't be trusted for this. */
export function airborneLeg(t: TravelView): FlightLeg | null {
  return orderedLegs(t).find((l) => l.status === "air") ?? null;
}

/** The soonest thing on the calendar (plans + arrivals + wedding), from today on. */
function nextEvent(d: Dashboard): CalEv | null {
  const evs: CalEv[] = [];
  d.plans.forEach((p) => evs.push({ icon: categoryOf(p.category).icon, title: p.title, date: p.date, time: p.start_time, href: `/plans/${p.id}` }));
  d.travel.forEach((t) => { if (t.arrivalIso) evs.push({ icon: "✈️", title: `${t.title} arrive`, date: tripDateOf(t.arrivalIso), time: fmtTime24(t.arrivalIso), href: `/flights/${t.id}` }); });
  evs.push({ icon: "💍", title: "Wedding / Roora", date: d.settings.wedding_date, time: WEDDING_TIME, href: d.settings.wedding_url || "/calendar" });
  evs.push({ icon: GOGO_BIRTHDAY.icon, title: GOGO_BIRTHDAY.title, date: GOGO_BIRTHDAY.date, time: GOGO_BIRTHDAY.time, href: "/calendar" });
  return evs.filter((e) => e.date >= d.today).sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")))[0] ?? null;
}

function evWhen(ev: CalEv, today: string): string {
  const iso = tripInstant(ev.date, ev.time);
  return ev.date === today ? (ev.time ? fmtTime(iso) : "Today") : fmtDayShortUpper(iso);
}

/** Wedding-toned fallback banner: the next calendar event. */
function EventBanner({ ev, today }: { ev: CalEv | null; today: string }) {
  return (
    <Link href={ev?.href ?? "/calendar"} className="relative mt-1 flex w-full items-center gap-3.5 overflow-hidden rounded-[22px] p-[18px_20px] text-left text-white shadow-[0_16px_28px_-16px_rgba(60,37,64,.6)]" style={{ background: "var(--grad-wed)" }}>
      <span className="pointer-events-none absolute -right-8 -top-12 h-44 w-44 rounded-full" style={{ background: "radial-gradient(circle,rgba(255,255,255,.28),transparent 70%)" }} />
      <span className="relative text-3xl" aria-hidden>{ev?.icon ?? "📅"}</span>
      <span className="relative flex min-w-0 flex-col">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.09em] opacity-90">{ev ? `Next up · ${evWhen(ev, today)}` : "Calendar"}</span>
        <span className="disp mt-1 truncate text-[22px] font-extrabold leading-none">{ev?.title ?? "Nothing scheduled yet"}</span>
      </span>
      <span className="relative ml-auto text-2xl opacity-90" aria-hidden>›</span>
    </Link>
  );
}

/** Flight-toned banner shell: same footprint as WeddingBanner, links into a group. */
function FlightBanner({ href, emoji, eyebrow, headline, sub }: { href: string; emoji: string; eyebrow: string; headline: string; sub?: string }) {
  return (
    <Link href={href} className="relative mt-1 flex w-full items-center gap-3.5 overflow-hidden rounded-[22px] bg-flight p-[18px_20px] text-left text-white shadow-[0_16px_28px_-16px_rgba(12,20,32,.7)]">
      <span className="pointer-events-none absolute -right-8 -top-12 h-44 w-44 rounded-full" style={{ background: "var(--flight-radial)" }} />
      <span className="relative text-3xl" aria-hidden>{emoji}</span>
      <span className="relative flex min-w-0 flex-col">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.09em] text-[var(--flight-label)]">{eyebrow}</span>
        <span className="disp mt-1 truncate text-[22px] font-extrabold leading-none">{headline}</span>
        {sub && <span className="mono mt-1.5 truncate text-[11.5px] font-semibold text-[var(--flight-label)]">{sub}</span>}
      </span>
      <span className="relative ml-auto text-2xl opacity-90" aria-hidden>›</span>
    </Link>
  );
}

/**
 * Hero banner keyed off the calendar, not the viewer's location: the next
 * airport run in either direction (who, which flight, the Harare time, and
 * whether a driver is still needed), falling back to the next calendar event.
 */
export function MyBanner({ d }: { d: Dashboard }) {
  // The next run to or from Harare airport that is still ahead of us.
  const run = heroRun(d);
  if (run) {
    const m = RUN_META[run.kind];
    const today = tripDateOf(run.hreIso) === d.today;
    const when = today ? "today" : fmtDayShortUpper(run.hreIso);
    // A drop-off has no pickup record of its own, so only a pickup can be short
    // a driver, and a cancelled flight needs nobody.
    const pickup = pickupForLeg(run.trip, run.leg.id);
    const needsDriver = !run.cancelled && run.kind === "pickup" && Boolean(pickup && !pickup.driver_user_id);
    const eyebrow = run.cancelled
      ? `${m.label} cancelled · ${when}`
      : run.kind === "pickup"
        ? `Next airport pickup · ${when}`
        : `Airport drop-off · ${when}`;
    const sub = run.cancelled
      ? `${run.leg.flight_number} · flight cancelled`
      : [run.leg.flight_number, runTimeSummary(run), needsDriver ? "driver needed" : null].filter(Boolean).join(" · ");
    return <FlightBanner href={`/flights/${run.tripId}`} emoji={m.emoji} eyebrow={eyebrow} headline={`${crew(run.trip)} ${run.trip.title}`} sub={sub} />;
  }

  // Nothing flight-related to surface — fall back to the next calendar event.
  return <EventBanner ev={nextEvent(d)} today={d.today} />;
}

/** Flight-toned stat tile for the desktop command-centre stat bar. */
function FlightStatTile({ href, eyebrow, value, sub }: { href: string; eyebrow: string; value: string; sub: string }) {
  return (
    <Link href={href} className="flex min-h-[88px] flex-col overflow-hidden rounded-2xl bg-flight p-4 text-white">
      <div className="mono truncate text-[10px] font-medium uppercase tracking-wide text-[var(--flight-label)]">{eyebrow}</div>
      <div className="disp mt-auto truncate text-[26px] font-extrabold">{value}</div>
      <div className="truncate text-[13px] font-extrabold text-[var(--flight-label)]">{sub}</div>
    </Link>
  );
}

/** Desktop counterpart of MyBanner: the next airport run, compact stat-tile shape. */
export function MyStatTile({ d }: { d: Dashboard }) {
  const run = heroRun(d);
  if (run) {
    const m = RUN_META[run.kind];
    const today = tripDateOf(run.hreIso) === d.today;
    const pickup = pickupForLeg(run.trip, run.leg.id);
    const needsDriver = !run.cancelled && run.kind === "pickup" && Boolean(pickup && !pickup.driver_user_id);
    const value = run.cancelled ? "Cancelled" : today ? fmtTime(run.hreIso) : fmtDayShortUpper(run.hreIso);
    const departs = run.kind === "dropoff" ? fmtTime(legDeparture(run.leg)) : "";
    const sub = needsDriver
      ? `${run.trip.title} · driver needed`
      : run.kind === "dropoff" && departs
        ? `Departs ${departs} · ${crew(run.trip)} ${run.trip.title}`
        : `${crew(run.trip)} ${run.trip.title}`;
    const eyebrow = run.cancelled
      ? `${m.emoji} ${m.label} · ${today ? "today" : fmtDayShortUpper(run.hreIso)}`
      : today ? `${m.emoji} ${m.label} · today` : `${m.emoji} Next ${m.label.toLowerCase()}`;
    return <FlightStatTile href={`/flights/${run.tripId}`} eyebrow={eyebrow} value={value} sub={sub} />;
  }

  // Fall back to the next calendar event.
  const ev = nextEvent(d);
  return (
    <Link href={ev?.href ?? "/calendar"} className="flex min-h-[88px] flex-col overflow-hidden rounded-2xl p-4 text-white" style={{ background: "var(--grad-wed)" }}>
      <div className="mono truncate text-[10px] font-medium uppercase tracking-wide opacity-90">{ev ? `${ev.icon} Next up` : "📅 Calendar"}</div>
      <div className="disp mt-auto truncate text-[26px] font-extrabold">{ev ? evWhen(ev, d.today) : "Open"}</div>
      <div className="truncate text-[13px] font-extrabold opacity-90">{ev?.title ?? "See the agenda"}</div>
    </Link>
  );
}

/**
 * One car run to or from Harare airport. Every time here comes off the run
 * instant itself, so a flight that lands after midnight reads as the day it
 * actually lands on. The driver control only appears on a requested pickup that
 * is still going, since a drop-off has no pickup record behind it and a
 * cancelled flight has nowhere to drive to.
 */
function RunRow({ run, ctx }: { run: AirportRun; ctx: HomeCtx }) {
  const { d, me } = ctx;
  const m = RUN_META[run.kind];
  const t = run.trip;
  const pickup = run.kind === "pickup" ? pickupForLeg(t, run.leg.id) : null;
  const driver = pickup?.driver_user_id ? d.users.find((u) => u.id === pickup.driver_user_id) ?? null : null;
  const today = tripDateOf(run.hreIso) === d.today;
  const showDriver = !run.cancelled && Boolean(pickup);
  const departureTime = run.kind === "dropoff" ? fmtTime(legDeparture(run.leg)) : "";
  const when = today ? "Today" : fmtDayShortUpper(run.hreIso);
  return (
    <div className="border-b border-line2 px-4 py-3.5 last:border-0">
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden>{m.emoji}</span>
        <Link href={`/flights/${t.id}`} className="min-w-0 flex-1">
          <span className="mono flex items-center gap-1.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-honey">
            {m.label}
            {run.cancelled && <span className="rounded-full bg-chip px-1.5 py-0.5 text-berry">Cancelled</span>}
          </span>
          <span className="block truncate text-[15px] font-extrabold">{crew(t)} {t.title}</span>
          <span className="mono block text-[10.5px] text-muted">{run.leg.flight_number} · {run.leg.origin_airport}→{run.leg.destination_airport}</span>
        </Link>
        <span className="flex-none text-right">
          <span className="mono block text-[15px] font-semibold">{fmtTime(run.hreIso)}</span>
          <span className="mono block text-[9.5px] font-semibold uppercase text-muted">{run.kind === "dropoff" ? "Check-in" : when}</span>
          {run.kind === "dropoff" && (
            <span className="mono block text-[9.5px] font-semibold uppercase text-muted">
              {[when, departureTime ? `departs ${departureTime}` : null].filter(Boolean).join(" · ")}
            </span>
          )}
        </span>
      </div>
      {showDriver && (
        <div className="mt-2.5 flex items-center gap-2.5 pl-[38px]">
          <span className="text-lg" aria-hidden>🚗</span>
          <PickupControl pickupId={pickup!.id} driver={driver} meId={me.id} isAdmin={me.is_admin} canDrive={me.is_admin || me.roles.includes("driver")} drivers={d.users.filter((u) => u.is_admin || u.roles.includes("driver"))} enRoute={pickup!.driver_en_route} />
        </div>
      )}
    </div>
  );
}

/**
 * The leg the traveller is on plus where it sits in the journey they will
 * actually fly. Cancelled legs are dropped first, so a stepper never counts a
 * hop nobody is taking or greys a pip as flown.
 */
function legStep(trip: TravelView) {
  const legs = orderedLegs(trip).filter((l) => l.status !== "cancelled");
  const cur = currentLeg(legs);
  return { legs, cur, idx: cur ? legs.findIndex((l) => l.id === cur.id) : -1 };
}

/**
 * An instant read at one end of a leg. Where we know the airport it is that
 * airport's own clock, matching the flight detail page; where we don't it falls
 * back to trip time and says so, so a Harare clock is never passed off as local.
 */
function endTime(iso: string | null, iata: string): { time: string; day: string; zone: string } {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return { time: "TBC", day: "", zone: "" };
  const tz = airportZone(iata);
  return { time: fmtTimeIn(iso, tz), day: fmtDayShortIn(iso, tz), zone: fmtZoneLabel(iso, tz) };
}

function departureSource(l: FlightLeg): string {
  if (l.actual_departure) return "Actual";
  if (l.estimated_departure) return "Est.";
  if (l.scheduled_departure) return "Sched.";
  return "TBC";
}

function arrivalSource(l: FlightLeg): string {
  if (l.actual_arrival) return "Actual";
  if (l.estimated_arrival) return "Est.";
  if (l.scheduled_arrival) return "Sched.";
  return "TBC";
}

/**
 * The viewer's own flight: the leg they're on right now, big, with a stepper
 * for whatever is left to fly. Renders nothing once every leg has landed.
 * Each end is shown on its own airport's clock with the zone and the day, so
 * the card agrees with the ticket and with the flight detail page. Anything the
 * airline hasn't published yet reads as TBC rather than blank.
 */
function MyFlightCard({ trip }: { trip: TravelView }) {
  const { legs, cur, idx } = legStep(trip);
  if (!cur) return null;
  const rest = legs.slice(idx + 1);
  const dep = legDeparture(cur);
  const arr = legArrival(cur);
  const depAt = endTime(dep, cur.origin_airport);
  const arrAt = endTime(arr, cur.destination_airport);
  const depMeta = [departureSource(cur) !== "TBC" ? departureSource(cur) : null, depAt.zone].filter(Boolean).join(" ");
  const arrMeta = [arrivalSource(cur) !== "TBC" ? arrivalSource(cur) : null, arrAt.zone].filter(Boolean).join(" ");
  const mins = minutesBetween(dep, arr);
  const late = cur.status !== "landed" && (cur.delay_minutes ?? 0) > 0;
  const chips = [
    cur.terminal_departure ? `Terminal ${cur.terminal_departure}` : null,
    cur.gate_departure ? `Gate ${cur.gate_departure}` : null,
    cur.terminal_arrival ? `Arrives T${cur.terminal_arrival}` : null,
    cur.aircraft_type_code ?? cur.aircraft_type,
  ].filter(Boolean) as string[];

  return (
    <Link href={`/flights/${trip.id}`} className="block transition-transform active:scale-[.985]">
      <div className="relative overflow-hidden rounded-[24px] bg-flight p-[19px] text-white shadow-[0_18px_34px_-20px_rgba(29,23,16,.7)]">
        <span className="pointer-events-none absolute -right-8 -top-11 h-48 w-48 rounded-full" style={{ background: "var(--flight-radial)" }} />
        <div className="relative flex items-center justify-between gap-2">
          <div className="min-w-0">
            <span className="mono text-[18px] font-semibold">{cur.flight_number}</span>
            <span className="ml-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--flight-label)]">{cur.airline_name}</span>
          </div>
          <span className="mono inline-flex flex-none items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
            {cur.status === "air" && <span className="zc-pulse h-1.5 w-1.5 rounded-full bg-honey2" />}
            {flightStatusMeta(cur.status).label}
          </span>
        </div>
        <div className="relative mt-3.5 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <div className="min-w-0">
            <div className="mono text-[28px] font-semibold leading-none">{cur.origin_airport}</div>
            <div className="mt-1 truncate text-[11px] font-bold text-[var(--flight-label)]">{cur.origin_city}</div>
            <div className="mono mt-1.5 text-[14px] font-semibold">
              {depAt.time}
              {depMeta && <span className="ml-1 text-[10px] text-[var(--flight-label)]">{depMeta}</span>}
            </div>
            {depAt.day && <div className="mono text-[10px] text-[var(--flight-label)]">{depAt.day}</div>}
          </div>
          <div className="flex flex-col items-center gap-1 pb-1 text-[var(--flight-label)]">
            <span aria-hidden>✈</span>
            {mins != null && mins > 0 && <span className="mono text-[10px] font-semibold">{durationLabel(mins)}</span>}
          </div>
          <div className="min-w-0 text-right">
            <div className="mono text-[28px] font-semibold leading-none">{cur.destination_airport}</div>
            <div className="mt-1 truncate text-[11px] font-bold text-[var(--flight-label)]">{cur.destination_city}</div>
            <div className="mono mt-1.5 text-[14px] font-semibold">
              {arrAt.time}
              {arrMeta && <span className="ml-1 text-[10px] text-[var(--flight-label)]">{arrMeta}</span>}
            </div>
            {arrAt.day && <div className="mono text-[10px] text-[var(--flight-label)]">{arrAt.day}</div>}
          </div>
        </div>
        {(chips.length > 0 || late) && (
          <div className="mono relative mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/10 pt-2.5 text-[11px] text-[var(--flight-label)]">
            {late && <span className="text-honey2">{cur.delay_minutes} min late</span>}
            {chips.map((c) => <span key={c}>{c}</span>)}
          </div>
        )}
        <div className="relative mt-3 flex items-center gap-2.5 border-t border-white/10 pt-3">
          <span className="mono flex-none text-[10px] font-bold uppercase tracking-wide text-[var(--flight-label)]">
            {legs.length > 1 ? `Leg ${idx + 1} of ${legs.length}` : "Direct"}
          </span>
          <span className="flex flex-none items-center gap-1" aria-hidden>
            {legs.map((l, i) => (
              <span key={l.id} className={cn("h-1.5 rounded-full", i === idx ? "w-6 bg-honey2" : i < idx ? "w-3.5 bg-white/35" : "w-3.5 bg-white/15")} />
            ))}
          </span>
          <span className="mono ml-auto truncate text-[10.5px] font-semibold text-[var(--flight-label)]">
            {rest.length ? `Then ${rest.map((l) => l.destination_airport).join(" › ")}` : "Last hop"}
          </span>
        </div>
      </div>
    </Link>
  );
}

export interface Nudge { icon: string; text: string; href: string }

/** Things on the home screen that specifically need this viewer to act. */
export function needsMe(d: Dashboard, me: PublicUser): Nudge[] {
  const out: Nudge[] = [];
  for (const t of d.travel) {
    if (t.status === "arrived") continue;
    const iAmOn = t.members.some((m) => m.id === me.id);
    const openPickups = t.pickups.filter((p) => p.requested && !p.driver_user_id);
    const assignedPickups = t.pickups.filter((p) => p.driver_user_id === me.id);
    if (openPickups.length && iAmOn) {
      out.push({ icon: "🚗", text: "Your flight still needs a driver", href: `/flights/${t.id}` });
    }
    if (assignedPickups.length && t.arrivalIso && tripDateOf(t.arrivalIso) === d.today) {
      out.push({ icon: "🛬", text: `You're picking up ${t.title} today`, href: `/flights/${t.id}` });
    }
  }
  if (me.roles.includes("driver") || me.is_admin) {
    const open = d.travel.flatMap((t) =>
      t.status === "arrived" || t.members.some((m) => m.id === me.id)
        ? []
        : t.pickups.filter((p) => p.requested && !p.driver_user_id),
    );
    if (open.length) out.push({ icon: "🚗", text: `${open.length} pickup${open.length > 1 ? "s" : ""} need a driver`, href: "/flights" });
  }
  const myTasks = d.tasks.filter((t) => !t.completed && t.assigned_to === me.id);
  if (myTasks.length) out.push({ icon: "✅", text: myTasks.length === 1 ? `Task: ${myTasks[0].title}` : `${myTasks.length} tasks are on you`, href: "/tasks" });
  const myShop = d.shopping.filter((s) => !s.completed && s.claimed_by === me.id);
  if (myShop.length) out.push({ icon: "🛒", text: myShop.length === 1 ? `Buy: ${myShop[0].item}` : `${myShop.length} things to buy`, href: "/shopping" });
  return out.slice(0, 3);
}

export function NeedsMe({ items, className }: { items: Nudge[]; className?: string }) {
  if (!items.length) return null;
  return (
    <div className={`overflow-hidden rounded-[16px] border border-[color-mix(in_srgb,var(--honey)_35%,transparent)] bg-[color-mix(in_srgb,var(--honey)_10%,var(--card))] ${className ?? ""}`}>
      <div className="mono px-4 pt-2.5 text-[10px] font-bold uppercase tracking-wide text-honey">Needs you</div>
      {items.map((n, i) => (
        <Link key={i} href={n.href} className="flex items-center gap-3 px-4 py-2.5">
          <span className="text-lg" aria-hidden>{n.icon}</span>
          <span className="flex-1 text-[14px] font-extrabold leading-tight">{n.text}</span>
          <span className="text-muted" aria-hidden>›</span>
        </Link>
      ))}
    </div>
  );
}

function PersonChip({ u }: { u: PublicUser }) {
  return (
    <Link href="/info" className="zc-chip">
      <span className="text-lg" aria-hidden>{u.emoji}</span>
      <span className="flex flex-col leading-tight">
        <span>{u.name}</span>
        {u.staying_at && <span className="text-[10px] font-semibold text-muted">📍 {u.staying_at}</span>}
      </span>
    </Link>
  );
}

function WhosHere({ here }: { here: PublicUser[] }) {
  // Group people by where they're staying; those without a location yet fall
  // back to a flat list (locations get assigned by an admin later).
  const groups = new Map<string, PublicUser[]>();
  const noLocation: PublicUser[] = [];
  for (const u of here) {
    if (u.staying_at) (groups.get(u.staying_at) ?? groups.set(u.staying_at, []).get(u.staying_at)!).push(u);
    else noLocation.push(u);
  }

  if (groups.size === 0) {
    return (
      <div className="flex flex-wrap gap-2">
        {here.slice(0, 4).map((u) => <PersonChip key={u.id} u={u} />)}
        {here.length > 4 && <Link href="/info" className="self-center text-[13px] font-extrabold text-muted">+{here.length - 4} more</Link>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {[...groups].map(([loc, people]) => (
        <div key={loc}>
          <div className="mono mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">📍 {loc} · {people.length}</div>
          <div className="flex flex-wrap gap-2">{people.map((u) => <PersonChip key={u.id} u={u} />)}</div>
        </div>
      ))}
      {noLocation.length > 0 && (
        <div>
          <div className="mono mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Location not set · {noLocation.length}</div>
          <div className="flex flex-wrap gap-2">{noLocation.map((u) => <PersonChip key={u.id} u={u} />)}</div>
        </div>
      )}
    </div>
  );
}

// ---- command centre panel primitives ----
function Panel({ title, meta, link, pad, collapsible, children }: { title: string; meta?: ReactNode; link?: { label: string; href: string }; pad?: boolean; collapsible?: boolean; children: ReactNode }) {
  const header = (
    <>
      <h3 className="disp text-base font-extrabold">{title}</h3>
      {meta && <span className="mono ml-auto flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-muted">{meta}</span>}
    </>
  );
  const body = <div className={pad ? "px-3.5 pb-4 pt-1.5" : "pb-1.5"}>{children}</div>;
  return (
    <section className="zc-card flex flex-col overflow-hidden">
      {collapsible ? (
        <details open className="group">
          <summary className={`flex cursor-pointer list-none items-center gap-2 px-[18px] pb-1.5 pt-4 [&::-webkit-details-marker]:hidden`}>
            {header}
            <span className={`text-muted transition-transform group-open:rotate-90 ${meta ? "" : "ml-auto"}`} aria-hidden>›</span>
          </summary>
          {body}
        </details>
      ) : (
        <>
          <div className="flex items-center gap-2 px-[18px] pb-1.5 pt-4">{header}</div>
          {body}
        </>
      )}
      {link && <Link href={link.href} className="mono block border-t border-line2 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-honey">{link.label} →</Link>}
    </section>
  );
}
function EventRow({ icon, title, lead, href }: { icon: string; title: string; lead: string; href?: string }) {
  const inner = (
    <div className="flex items-center gap-3 border-b border-line2 px-4 py-3 last:border-0">
      <span className="mono w-[58px] flex-none text-[11px] font-semibold text-muted">{lead}</span>
      <span className="text-lg" aria-hidden>{icon}</span>
      <span className="text-sm font-extrabold">{title}</span>
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

function runEventTitle(run: AirportRun): string {
  const departs = run.kind === "dropoff" ? fmtTime(legDeparture(run.leg)) : "";
  return [
    `${RUN_META[run.kind].label} · ${run.trip.title}`,
    departs ? `departs ${departs}` : null,
  ].filter(Boolean).join(" · ");
}
function PanelEmpty({ emoji, text }: { emoji?: string; text: string }) {
  return (
    <div className="px-4 py-6 text-center text-[13px] font-bold text-ink2">
      {emoji && <div className="mb-1.5 text-3xl" aria-hidden>{emoji}</div>}
      {text}
    </div>
  );
}

// ============================================================
// Render maps — one entry per widget id, per surface. A widget that has
// nothing to show for the current data returns null (it simply doesn't
// appear), while still being listed in the layout editor.
// ============================================================

/** Mobile home widget renderers (compact, single-column stack). */
export function renderMobileWidget(id: string, ctx: HomeCtx): ReactNode {
  const { d } = ctx;
  switch (id) {
    case "family-photos":
      return ctx.photos.length > 0 ? (
        <section className="mt-4">
          <SectionHeader meta={<Link href="/photos" className="text-honey">See all ›</Link>}>Family photos</SectionHeader>
          <PhotoCarousel photos={ctx.photos} aspect="16 / 11" />
        </section>
      ) : null;

    case "in-the-air":
      return (
        <section>
          <SectionHeader meta={ctx.activeFlights.length ? <><LiveDot /> {ctx.activeFlights.length > 1 ? `${ctx.activeFlights.length} live` : `updated ${timeAgo(airborneLeg(ctx.activeFlights[0])?.last_synced_at ?? new Date().toISOString())}`}</> : "0 active"}>In the air</SectionHeader>
          {ctx.activeFlights.length ? (
            <div className="flex flex-col gap-3">{ctx.activeFlights.map((t) => <FlightCard key={t.id} travel={t} full />)}</div>
          ) : (
            <PlaneFacts />
          )}
        </section>
      );

    case "my-flight":
      return ctx.myFlight ? (
        <section>
          <SectionHeader>My flight</SectionHeader>
          <MyFlightCard trip={ctx.myFlight} />
        </section>
      ) : null;

    case "airport-runs": {
      const runs = d.runsAhead;
      return (
        <section>
          <SectionHeader meta={<Link href="/flights" className="text-honey">See all ›</Link>}>Airport runs</SectionHeader>
          {runs.length ? (
            <div className="zc-card overflow-hidden p-0">{runs.slice(0, 4).map((r) => <RunRow key={r.id} run={r} ctx={ctx} />)}</div>
          ) : (
            <div className="zc-card px-6 py-7 text-center">
              <div className="text-4xl" aria-hidden>🚗</div>
              <div className="disp mt-2 text-lg font-extrabold">Quiet airport day</div>
              <div className="mt-1 text-sm text-ink2">No pickups or drop-offs coming up.</div>
            </div>
          )}
        </section>
      );
    }

    case "whos-where":
      return (
        <section>
          <details open className="group">
            <summary className="mt-6 mb-3 flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
              <h2 className="disp text-lg font-extrabold">Who&apos;s where</h2>
              <span className="mono ml-auto flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                {d.here.length} here
                <span className="text-sm transition-transform group-open:rotate-90" aria-hidden>›</span>
              </span>
            </summary>
            <WhosHere here={d.here} />
          </details>
        </section>
      );

    case "my-tasks":
      return ctx.myTasks.length ? (
        <section>
          <SectionHeader meta={<Link href="/tasks" className="text-honey">See all ›</Link>}>My tasks</SectionHeader>
          <List>{ctx.myTasks.slice(0, 4).map((t) => <TaskItemRow key={t.id} task={t} meId={ctx.me.id} today={d.today} isAdmin={ctx.me.is_admin} />)}</List>
        </section>
      ) : null;

    case "tonight":
      return d.dinner ? (
        <section>
          <SectionHeader>Tonight</SectionHeader>
          <Dismissable id={`dinner-${d.dinner.id}`}>
            <Link href={`/plans/${d.dinner.id}`} className="flex items-center gap-3.5 rounded-[22px] p-[17px] text-white shadow-[0_14px_26px_-18px_rgba(30,45,70,.6)]" style={{ background: "var(--grad-dinner)" }}>
              <span className="text-3xl" aria-hidden>🍲</span>
              <span><span className="disp block text-[17px] font-extrabold">{d.dinner.title}</span><span className="block text-[12.5px] font-bold opacity-90">{d.dinner.location}</span></span>
              <span className="ml-auto mr-7 text-right">
                <span className="mono block text-[15px] font-semibold">{fmtTime(tripInstant(d.dinner.date, d.dinner.start_time))}</span>
                <ViewerTime iso={d.dinner.start_time ? tripInstant(d.dinner.date, d.dinner.start_time) : null} stacked className="text-[10.5px] text-white/75" />
              </span>
            </Link>
          </Dismissable>
        </section>
      ) : null;

    case "pinned":
      return d.pinned ? (
        <section className="pt-6">
          <Dismissable id={`pinned-${d.pinned.id}`}>
            <div className="flex items-center gap-3 rounded-[18px] border border-[color-mix(in_srgb,var(--warn)_38%,transparent)] bg-[color-mix(in_srgb,var(--warn)_12%,var(--card))] px-4 py-3.5 pr-10">
              <span className="text-xl" aria-hidden>📢</span>
              <div><div className="mono text-[10px] font-semibold uppercase tracking-wide text-warn">Pinned notice</div><div className="mt-0.5 text-[15px] font-extrabold text-ink">{d.pinned.title}</div></div>
            </div>
          </Dismissable>
        </section>
      ) : null;

    default:
      return null;
  }
}

/** Desktop command-centre widget renderers (card panels). */
export function renderDesktopWidget(id: string, ctx: HomeCtx): ReactNode {
  const { d, me } = ctx;
  switch (id) {
    case "family-photos":
      return ctx.photos.length > 0 ? (
        <Panel title="Family photos" meta="Latest snaps" link={{ label: "Open photos", href: "/photos" }} pad>
          <PhotoCarousel photos={ctx.photos} aspect="21 / 9" />
        </Panel>
      ) : null;

    case "today": {
      const w = d.weather;
      return (
        <Panel title="Today" meta="What's happening">
          {w || d.pinned || d.runsToday.length || ctx.todayPlans.length ? (
            <div>
              {d.pinned && <EventRow icon="📢" title={d.pinned.title} lead="Now" />}
              {w && <EventRow icon={w.emoji} title={`${w.label} · ${w.min}°–${w.max}°`} lead="Harare" />}
              {d.runsToday.map((r) => <EventRow key={r.id} icon={RUN_META[r.kind].emoji} title={runEventTitle(r)} lead={fmtTime(r.hreIso)} href={`/flights/${r.tripId}`} />)}
              {ctx.todayPlans.map((p) => <EventRow key={p.id} icon={categoryOf(p.category).icon} title={p.title} lead={p.start_time ? fmtTime(tripInstant(p.date, p.start_time)) : "All day"} href={`/plans/${p.id}`} />)}
            </div>
          ) : <PanelEmpty emoji="🌤️" text="Nothing major today" />}
        </Panel>
      );
    }

    case "my-flight": {
      if (!ctx.myFlight) return null;
      // The card carries the stepper itself, so the meta names the trip instead.
      if (!legStep(ctx.myFlight).cur) return null;
      return (
        <Panel title="My flight" meta={ctx.myFlight.title} pad>
          <MyFlightCard trip={ctx.myFlight} />
        </Panel>
      );
    }

    case "coming-up":
      return (
        <Panel title="Coming up" meta="Next few days" link={{ label: "Open calendar", href: "/calendar" }}>
          {ctx.comingUp.length ? ctx.comingUp.map((e, i) => <EventRow key={i} icon={e.icon} title={e.title} lead={fmtDayShortUpper(tripInstant(e.date))} href={e.href} />) : <PanelEmpty text="Nothing coming up" />}
        </Panel>
      );

    case "whos-where":
      return (
        <Panel title="Who's where" meta={`${d.here.length} here`} collapsible>
          <div className="px-3.5 pb-1"><WhosHere here={d.here} /></div>
        </Panel>
      );

    case "in-the-air":
      return (
        <Panel title="In the air" meta={ctx.activeFlights.length ? <><LiveDot /> {ctx.activeFlights.length > 1 ? `${ctx.activeFlights.length} live` : "live"}</> : "0 active"} pad>
          {ctx.activeFlights.length ? (
            <div className="flex flex-col gap-3">{ctx.activeFlights.map((t) => <FlightCard key={t.id} travel={t} full />)}</div>
          ) : <PlaneFacts framed={false} />}
        </Panel>
      );

    case "airport-runs": {
      const runs = d.runsAhead;
      return (
        <Panel title="Airport runs" meta={`${runs.length} ${runs.length === 1 ? "run" : "runs"}`} link={{ label: "Open flights", href: "/flights" }}>
          {runs.length ? runs.map((r) => <RunRow key={r.id} run={r} ctx={ctx} />) : <PanelEmpty emoji="🚗" text="No pickups or drop-offs coming up" />}
        </Panel>
      );
    }

    case "shopping": {
      const open = d.shopping.filter((s) => !s.completed);
      return (
        <Panel title="Shopping" link={{ label: "Open shopping", href: "/shopping" }}>
          {open.slice(0, 5).map((s) => <ShoppingItemRow key={s.id} item={s} meId={me.id} />)}
          {open.length === 0 && <PanelEmpty emoji="😎" text="All stocked up" />}
        </Panel>
      );
    }

    case "tasks": {
      const open = d.tasks.filter((t) => !t.completed);
      return (
        <Panel title="Tasks" link={{ label: "Open tasks", href: "/tasks" }}>
          {open.slice(0, 5).map((t) => <TaskItemRow key={t.id} task={t} meId={me.id} isAdmin={me.is_admin} />)}
          {open.length === 0 && <PanelEmpty emoji="🎉" text="Nothing to do" />}
        </Panel>
      );
    }

    case "activity":
      return (
        <Panel title="Activity" link={{ label: "Open activity", href: "/activity" }}>
          <div className="px-4 py-1">
            {d.activity.map((a) => (
              <div key={a.id} className="flex gap-3 border-b border-line2 py-3 last:border-0">
                <span className="grid h-8 w-8 flex-none place-items-center rounded-full bg-chip text-lg" aria-hidden>{a.actor?.emoji ?? "👤"}</span>
                <div><div className="text-sm font-semibold leading-snug"><b>{a.actor?.name ?? "Someone"}</b> {(a.metadata as { text?: string })?.text}</div><div className="mono mt-0.5 text-[10.5px] text-muted">{timeAgo(a.created_at)}</div></div>
              </div>
            ))}
          </div>
        </Panel>
      );

    case "important-info":
      return (
        <Panel title="Important info" link={{ label: "Open info", href: "/info" }}>
          <div className="px-1">
            {ctx.infoSummary.map((g) => (
              <Link key={g.category} href="/info" className="flex items-center justify-between border-b border-line2 px-3 py-3 text-sm last:border-0">
                <span className="font-extrabold">{g.icon} {g.category}</span>
                <span className="text-muted">›</span>
              </Link>
            ))}
          </div>
        </Panel>
      );

    default:
      return null;
  }
}
