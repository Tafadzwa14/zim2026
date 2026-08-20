import Link from "next/link";
import type { ReactNode } from "react";
import type { Dashboard } from "@/lib/dashboard";
import { categoryOf, GOGO_BIRTHDAY } from "@/lib/display";
import { daysUntil, fmtDayShortUpper, fmtTime, fmtTime24, timeAgo, tripDateOf } from "@/lib/format";
import { FlightCard } from "@/components/flight-card";
import { LiveDot, SectionHeader } from "@/components/ui";
import { PickupControl, ShoppingItemRow, TaskItemRow } from "@/components/interactive";
import { PhotoCarousel } from "@/components/photo-gallery";
import { Dismissable } from "@/components/dismissable";
import type { PhotoView, TravelView } from "@/lib/repo/types";
import type { PublicUser } from "@/lib/types";

/**
 * Everything a widget needs to render, computed once by the home page and
 * passed down. Keeping the derived values here (rather than recomputing per
 * widget) means the render maps below stay cheap and synchronous.
 */
export interface HomeCtx {
  d: Dashboard;
  me: PublicUser;
  /** Every group airborne right now — can be more than one at the same time. */
  activeFlights: TravelView[];
  todayPlans: Dashboard["plans"];
  comingUp: { date: string; icon: string; title: string; href: string }[];
  infoSummary: { category: string; icon: string }[];
  photos: PhotoView[];
}

interface CalEv { icon: string; title: string; date: string; time: string | null; href: string }

/** The soonest thing on the calendar (plans + arrivals + wedding), from today on. */
function nextEvent(d: Dashboard): CalEv | null {
  const evs: CalEv[] = [];
  d.plans.forEach((p) => evs.push({ icon: categoryOf(p.category).icon, title: p.title, date: p.date, time: p.start_time, href: `/plans/${p.id}` }));
  d.travel.forEach((t) => { if (t.arrivalIso) evs.push({ icon: "✈️", title: `${t.title} arrive`, date: tripDateOf(t.arrivalIso), time: fmtTime24(t.arrivalIso), href: `/flights/${t.id}` }); });
  evs.push({ icon: "💍", title: "Wedding / Roora", date: d.settings.wedding_date, time: "11:00", href: d.settings.wedding_url || "/calendar" });
  evs.push({ icon: GOGO_BIRTHDAY.icon, title: GOGO_BIRTHDAY.title, date: GOGO_BIRTHDAY.date, time: GOGO_BIRTHDAY.time, href: "/calendar" });
  return evs.filter((e) => e.date >= d.today).sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")))[0] ?? null;
}

function evWhen(ev: CalEv, today: string): string {
  const iso = `${ev.date}T${ev.time ?? "00:00"}:00+02:00`;
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
 * Personalised hero banner keyed off the viewer:
 * - a traveller (not yet in Zimbabwe) sees their own flight — countdown to
 *   departure, or live arrival once airborne;
 * - someone already in Zimbabwe sees the next airport run (next arrival +
 *   flight + whether a driver is still needed).
 * Falls back to the family's next arrival, then the wedding countdown.
 */
export function MyBanner({ d, me }: { d: Dashboard; me: PublicUser }) {
  // A traveller's own group (still upcoming or in the air).
  const mine = d.travel.find((t) => t.status !== "arrived" && t.members.some((m) => m.id === me.id));

  if (mine && me.status !== "here") {
    const active = mine.activeLeg;
    if (me.status === "travelling" && active?.status === "air") {
      const arr = active.estimated_arrival ?? active.scheduled_arrival;
      return <FlightBanner href={`/flights/${mine.id}`} emoji="✈️" eyebrow="You're in the air" headline={`${active.origin_airport} → ${active.destination_airport}`} sub={`${active.flight_number} · lands ${fmtTime(arr)}`} />;
    }
    const first = mine.legs[0];
    const last = mine.legs[mine.legs.length - 1];
    const dep = first?.estimated_departure ?? first?.scheduled_departure ?? null;
    const route = first && last ? `${first.origin_airport} → ${last.destination_airport}` : mine.title;
    const left = dep ? daysUntil(tripDateOf(dep)) : null;
    const headline = left == null ? route : left === 0 ? "You fly today ✈️" : `${left} day${left === 1 ? "" : "s"} to departure`;
    return <FlightBanner href={`/flights/${mine.id}`} emoji="🧳" eyebrow={dep ? `You fly · ${fmtDayShortUpper(dep)}` : "Your trip"} headline={headline} sub={first ? `${first.flight_number} · ${route}` : "Flight details coming soon"} />;
  }

  // In Zimbabwe (or no trip of your own): the next airport run.
  const next = d.arrivingToday[0] ?? d.comingNext[0] ?? null;
  if (next) {
    const soonest = Boolean(d.arrivingToday[0]);
    const leg = next.activeLeg;
    const needsDriver = Boolean(next.pickup?.requested && !next.driver);
    const sub = [leg?.flight_number, `arrives ${soonest ? fmtTime(next.arrivalIso) : fmtDayShortUpper(next.arrivalIso)}`, needsDriver ? "driver needed" : null].filter(Boolean).join(" · ");
    return <FlightBanner href={`/flights/${next.id}`} emoji="🛬" eyebrow={soonest ? "Next airport run · today" : `Next airport run · ${fmtDayShortUpper(next.arrivalIso)}`} headline={`${next.members[0]?.emoji ?? "✈️"} ${next.title}`} sub={sub} />;
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

/** Desktop counterpart of MyBanner — same personalisation, compact stat-tile shape. */
export function MyStatTile({ d, me }: { d: Dashboard; me: PublicUser }) {
  const mine = d.travel.find((t) => t.status !== "arrived" && t.members.some((m) => m.id === me.id));

  if (mine && me.status !== "here") {
    const active = mine.activeLeg;
    if (me.status === "travelling" && active?.status === "air") {
      const arr = active.estimated_arrival ?? active.scheduled_arrival;
      return <FlightStatTile href={`/flights/${mine.id}`} eyebrow="✈️ You're flying" value={`${active.origin_airport}→${active.destination_airport}`} sub={`${active.flight_number} · lands ${fmtTime(arr)}`} />;
    }
    const first = mine.legs[0];
    const last = mine.legs[mine.legs.length - 1];
    const dep = first?.estimated_departure ?? first?.scheduled_departure ?? null;
    const left = dep ? daysUntil(tripDateOf(dep)) : null;
    const value = left == null ? "Your trip" : left === 0 ? "Today" : `${left} day${left === 1 ? "" : "s"}`;
    const route = first && last ? `${first.origin_airport}→${last.destination_airport}` : mine.title;
    return <FlightStatTile href={`/flights/${mine.id}`} eyebrow="🧳 You fly" value={value} sub={first ? `${first.flight_number} · ${route}` : "Flight TBC"} />;
  }

  const next = d.arrivingToday[0] ?? d.comingNext[0] ?? null;
  if (next) {
    const soonest = Boolean(d.arrivingToday[0]);
    const needsDriver = Boolean(next.pickup?.requested && !next.driver);
    const value = soonest ? fmtTime(next.arrivalIso) : fmtDayShortUpper(next.arrivalIso);
    const sub = needsDriver ? `${next.title} · driver needed` : `${next.members[0]?.emoji ?? "✈️"} ${next.title}`;
    return <FlightStatTile href={`/flights/${next.id}`} eyebrow={soonest ? "🛬 Airport run · today" : "🛬 Next airport run"} value={value} sub={sub} />;
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

function ArrivalRow({ t }: { t: TravelView }) {
  const leg = t.activeLeg;
  if (!leg) return null;
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
        <span className={`mono block text-[9.5px] font-semibold uppercase ${air ? "text-good" : late ? "text-warn" : "text-honey"}`}>{air ? "In air" : leg.status === "landed" ? "Landed" : late ? `${leg.delay_minutes}m late` : "Scheduled"}</span>
      </span>
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
    if (t.pickup?.requested && !t.pickup.driver_user_id && iAmOn) {
      out.push({ icon: "🚗", text: "Your flight still needs a driver", href: `/flights/${t.id}` });
    }
    if (t.pickup?.driver_user_id === me.id && t.arrivalIso && tripDateOf(t.arrivalIso) === d.today) {
      out.push({ icon: "🛬", text: `You're picking up ${t.title} today`, href: `/flights/${t.id}` });
    }
  }
  if (me.roles.includes("driver") || me.is_admin) {
    const open = d.travel.filter(
      (t) => t.status !== "arrived" && t.pickup?.requested && !t.pickup.driver_user_id && !t.members.some((m) => m.id === me.id),
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
    <Link href="/family" className="zc-chip">
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
        {here.length > 4 && <Link href="/family" className="self-center text-[13px] font-extrabold text-muted">+{here.length - 4} more</Link>}
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
      return ctx.activeFlights.length ? (
        <section>
          <SectionHeader meta={<><LiveDot /> {ctx.activeFlights.length > 1 ? `${ctx.activeFlights.length} live` : `updated ${timeAgo(ctx.activeFlights[0].activeLeg!.last_synced_at ?? new Date().toISOString())}`}</>}>In the air</SectionHeader>
          <div className="flex flex-col gap-3">{ctx.activeFlights.map((t) => <FlightCard key={t.id} travel={t} full />)}</div>
        </section>
      ) : null;

    case "arriving-today":
      return (
        <section>
          <SectionHeader>Arriving today</SectionHeader>
          {d.arrivingToday.length ? (
            <div className="zc-card overflow-hidden p-0">{d.arrivingToday.map((t) => <ArrivalRow key={t.id} t={t} />)}</div>
          ) : (
            <div className="zc-card px-6 py-7 text-center">
              <div className="text-4xl" aria-hidden>🛬</div>
              <div className="disp mt-2 text-lg font-extrabold">Quiet airport day</div>
              <div className="mt-1 text-sm text-ink2">{d.comingNext[0] ? `Next arrival: ${d.comingNext[0].title} · ${fmtDayShortUpper(d.comingNext[0].arrivalIso)}` : "No arrivals coming up"}</div>
            </div>
          )}
        </section>
      );

    case "whos-where":
      return (
        <section>
          <details open className="group">
            <summary className="mt-6 mb-3 flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
              <h2 className="disp text-lg font-extrabold">Who&apos;s where</h2>
              <span className="mono ml-auto flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">
                {d.here.length} in Zimbabwe
                <span className="text-sm transition-transform group-open:rotate-90" aria-hidden>›</span>
              </span>
            </summary>
            <WhosHere here={d.here} />
          </details>
        </section>
      );

    case "coming-next":
      return d.comingNext.length > 0 ? (
        <section>
          <SectionHeader>Coming next</SectionHeader>
          <div className="zc-card overflow-hidden p-0">
            {d.comingNext.slice(0, 3).map((t) => (
              <div key={t.id} className="flex items-center gap-3 border-b border-line2 px-4 py-3 last:border-0">
                <span className="mono flex-none rounded-lg bg-ink px-2.5 py-1 text-[11.5px] font-semibold text-paper">{fmtDayShortUpper(t.arrivalIso)}</span>
                <span className="text-[15px] font-extrabold">{t.members[0]?.emoji ?? "✈️"} {t.title}</span>
              </div>
            ))}
          </div>
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
              <span className="mono ml-auto mr-7 text-[15px] font-semibold">{fmtTime(`${d.dinner.date}T${d.dinner.start_time}:00+02:00`)}</span>
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

    case "today":
      return (
        <Panel title="Today" meta="What's happening">
          {d.pinned || d.arrivingToday.length || ctx.todayPlans.length ? (
            <div>
              {d.pinned && <EventRow icon="📢" title={d.pinned.title} lead="Now" />}
              {d.arrivingToday.map((t) => <EventRow key={t.id} icon="✈️" title={`${t.title} arrive`} lead={fmtTime(t.arrivalIso)} href={`/flights/${t.id}`} />)}
              {ctx.todayPlans.map((p) => <EventRow key={p.id} icon={categoryOf(p.category).icon} title={p.title} lead={p.start_time ? fmtTime(`${p.date}T${p.start_time}:00+02:00`) : "—"} href={`/plans/${p.id}`} />)}
            </div>
          ) : <PanelEmpty emoji="🌤️" text="Nothing major today" />}
        </Panel>
      );

    case "coming-up":
      return (
        <Panel title="Coming up" meta="Next few days" link={{ label: "Open calendar", href: "/calendar" }}>
          {ctx.comingUp.length ? ctx.comingUp.map((e, i) => <EventRow key={i} icon={e.icon} title={e.title} lead={fmtDayShortUpper(`${e.date}T00:00:00+02:00`)} href={e.href} />) : <PanelEmpty text="Nothing coming up" />}
        </Panel>
      );

    case "whos-where":
      return (
        <Panel title="Who's where" meta={`${d.here.length} in Zimbabwe`} collapsible>
          <div className="px-3.5 pb-1"><WhosHere here={d.here} /></div>
        </Panel>
      );

    case "in-the-air":
      return (
        <Panel title="In the air" meta={ctx.activeFlights.length ? <><LiveDot /> {ctx.activeFlights.length > 1 ? `${ctx.activeFlights.length} live` : "live"}</> : "0 active"} pad>
          {ctx.activeFlights.length ? (
            <div className="flex flex-col gap-3">{ctx.activeFlights.map((t) => <FlightCard key={t.id} travel={t} full />)}</div>
          ) : <PanelEmpty emoji="✈️" text="No family flights in the air right now" />}
        </Panel>
      );

    case "arrivals": {
      const upcoming = d.travel.filter((t) => t.status !== "arrived");
      return (
        <Panel title="Arrivals" meta="Flight board">
          {upcoming.length ? upcoming.map((t) => <ArrivalRow key={t.id} t={t} />) : <PanelEmpty text="No upcoming arrivals" />}
        </Panel>
      );
    }

    case "airport-pickups":
      return (
        <Panel title="Airport pickups" meta={`${d.pickupsOpen.length} runs`}>
          {d.pickupsOpen.length ? (
            d.pickupsOpen.map((t) => (
              <div key={t.id} className="flex items-center gap-3 border-b border-line2 px-4 py-3 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-extrabold">{t.members.map((m) => m.emoji).join(" ")} {t.title}</div>
                  <div className="mono text-[10.5px] text-muted">{fmtDayShortUpper(t.arrivalIso)} · {t.activeLeg?.flight_number}</div>
                </div>
                <PickupControl travelId={t.id} driver={t.pickup?.driver_user_id ? t.members.find((m) => m.id === t.pickup?.driver_user_id) ?? d.users.find((u) => u.id === t.pickup?.driver_user_id) ?? null : null} meId={me.id} isAdmin={me.is_admin} canDrive={me.is_admin || me.roles.includes("driver")} drivers={d.users.filter((u) => u.is_admin || u.roles.includes("driver"))} enRoute={t.pickup?.driver_en_route} />
              </div>
            ))
          ) : <PanelEmpty emoji="🚗" text="No pickups needed" />}
        </Panel>
      );

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
          {open.slice(0, 5).map((t) => <TaskItemRow key={t.id} task={t} meId={me.id} />)}
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
