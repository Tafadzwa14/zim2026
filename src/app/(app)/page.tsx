import Link from "next/link";
import { getDashboard, type Dashboard } from "@/lib/dashboard";
import { getCurrentUser } from "@/lib/identity";
import { categoryOf } from "@/lib/display";
import { daysUntil, fmtDayShortUpper, fmtTime, fmtTime24, fmtWeekdayLong, timeAgo, tripDateOf } from "@/lib/format";
import { FlightCard } from "@/components/flight-card";
import { LiveDot, SectionHeader } from "@/components/ui";
import { ThemeToggle } from "@/components/providers";
import { PickupControl, ShoppingItemRow, TaskItemRow } from "@/components/interactive";
import { Dismissable } from "@/components/dismissable";
import type { TravelView } from "@/lib/repo/types";
import type { PublicUser } from "@/lib/types";

export const dynamic = "force-dynamic";

interface CalEv { icon: string; title: string; date: string; time: string | null; href: string }

/** The soonest thing on the calendar (plans + arrivals + wedding), from today on. */
function nextEvent(d: Dashboard): CalEv | null {
  const evs: CalEv[] = [];
  d.plans.forEach((p) => evs.push({ icon: categoryOf(p.category).icon, title: p.title, date: p.date, time: p.start_time, href: `/plans/${p.id}` }));
  d.travel.forEach((t) => { if (t.arrivalIso) evs.push({ icon: "✈️", title: `${t.title} arrive`, date: tripDateOf(t.arrivalIso), time: fmtTime24(t.arrivalIso), href: `/flights/${t.id}` }); });
  evs.push({ icon: "💍", title: "Wedding / Roora", date: d.settings.wedding_date, time: "11:00", href: d.settings.wedding_url || "/calendar" });
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
function MyBanner({ d, me }: { d: Dashboard; me: PublicUser }) {
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
function MyStatTile({ d, me }: { d: Dashboard; me: PublicUser }) {
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

interface Nudge { icon: string; text: string; href: string }

/** Things on the home screen that specifically need this viewer to act. */
function needsMe(d: Dashboard, me: PublicUser): Nudge[] {
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

function NeedsMe({ items, className }: { items: Nudge[]; className?: string }) {
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

export default async function HomePage() {
  const [d, me] = await Promise.all([getDashboard(), getCurrentUser()]);
  if (!me) return null;
  const active = d.active[0]?.activeLeg ? d.active[0] : null;
  const nudges = needsMe(d, me);

  // command-centre event rows
  const todayPlans = d.plans.filter((p) => p.date === d.today);
  const comingUp = [
    ...d.comingNext.map((t) => ({ date: t.arrivalIso?.slice(0, 10) ?? "", icon: "✈️", title: `${t.title} arrive`, href: `/flights/${t.id}` })),
    ...d.plans.filter((p) => p.date > d.today).map((p) => ({ date: p.date, icon: categoryOf(p.category).icon, title: p.title, href: `/plans/${p.id}` })),
  ].filter((e) => e.date).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);

  return (
    <>
      {/* ============ MOBILE HOME ============ */}
      <div className="px-[18px] md:mx-auto md:max-w-4xl lg:hidden">
        <header className="sticky top-0 z-20 -mx-[18px] flex items-start justify-between gap-2.5 bg-paper px-[18px] pb-2.5 pt-4">
          <div>
            <h1 className="disp text-[26px] font-extrabold tracking-tight">{d.settings.app_title}</h1>
            <div className="mono mt-0.5 text-[11px] uppercase tracking-wide text-muted">{fmtWeekdayLong(new Date())}</div>
          </div>
          <div className="flex items-center gap-2">
            {me.is_admin && <Link href="/admin" className="rounded-full bg-ink px-3 py-[7px] text-[11px] font-extrabold text-paper">🛡️ Admin</Link>}
            <ThemeToggle className="flex h-10 w-10 items-center justify-center rounded-[13px] border border-line bg-card text-lg" />
            <Link href="/profile" className="flex h-10 w-10 items-center justify-center rounded-[13px] border border-line bg-card text-lg">{me.emoji}</Link>
          </div>
        </header>
        <div className="disp mt-0.5 text-lg font-bold">The crew is assembling ✈️</div>
        <MyBanner d={d} me={me} />
        <NeedsMe items={nudges} className="mt-3" />

        <div className="md:columns-2 md:gap-x-5">
          {active && (
            <section className="break-inside-avoid">
              <SectionHeader meta={<><LiveDot /> updated {timeAgo(active.activeLeg!.last_synced_at ?? new Date().toISOString())}</>}>In the air</SectionHeader>
              <FlightCard travel={active} full />
            </section>
          )}

          <section className="break-inside-avoid">
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

          <section className="break-inside-avoid">
            <SectionHeader meta={<Link href="/family">{d.here.length} in Zimbabwe</Link>}>Who&apos;s where</SectionHeader>
            <WhosHere here={d.here} />
          </section>

          {d.comingNext.length > 0 && (
            <section className="break-inside-avoid">
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
          )}

          {d.dinner && (
            <section className="break-inside-avoid">
              <SectionHeader>Tonight</SectionHeader>
              <Dismissable id={`dinner-${d.dinner.id}`}>
                <Link href={`/plans/${d.dinner.id}`} className="flex items-center gap-3.5 rounded-[22px] p-[17px] text-white shadow-[0_14px_26px_-18px_rgba(30,45,70,.6)]" style={{ background: "var(--grad-dinner)" }}>
                  <span className="text-3xl" aria-hidden>🍲</span>
                  <span><span className="disp block text-[17px] font-extrabold">{d.dinner.title}</span><span className="block text-[12.5px] font-bold opacity-90">{d.dinner.location}</span></span>
                  <span className="mono ml-auto mr-7 text-[15px] font-semibold">{fmtTime(`${d.dinner.date}T${d.dinner.start_time}:00+02:00`)}</span>
                </Link>
              </Dismissable>
            </section>
          )}

          {d.pinned && (
            <section className="break-inside-avoid pt-6">
              <Dismissable id={`pinned-${d.pinned.id}`}>
                <div className="flex items-center gap-3 rounded-[18px] border border-[color-mix(in_srgb,var(--warn)_38%,transparent)] bg-[color-mix(in_srgb,var(--warn)_12%,var(--card))] px-4 py-3.5 pr-10">
                  <span className="text-xl" aria-hidden>📢</span>
                  <div><div className="mono text-[10px] font-semibold uppercase tracking-wide text-warn">Pinned notice</div><div className="mt-0.5 text-[15px] font-extrabold text-ink">{d.pinned.title}</div></div>
                </div>
              </Dismissable>
            </section>
          )}
        </div>
      </div>

      {/* ============ DESKTOP COMMAND CENTRE ============ */}
      <div className="hidden px-8 pt-7 lg:block">
        <div className="mx-auto max-w-[1320px]">
          <div className="mb-5 flex flex-wrap items-center gap-6">
            <div>
              <h1 className="disp text-3xl font-extrabold tracking-tight">{d.settings.app_title}</h1>
              <div className="mono mt-1 text-xs uppercase tracking-wide text-muted">{fmtWeekdayLong(new Date())}</div>
            </div>
            <div className="grid min-w-[520px] flex-1 grid-cols-4 gap-3">
              <MyStatTile d={d} me={me} />
              <Link href="/flights" className="zc-card flex min-h-[88px] flex-col p-4">
                <div className="mono text-[10px] uppercase tracking-wide text-muted">✈️ In the air</div>
                <div className="disp mt-auto text-[26px] font-extrabold">{active ? active.activeLeg!.flight_number : "0"}</div>
                <div className="text-[13px] font-extrabold text-ink2">{active ? "In the air" : "None active"}</div>
              </Link>
              <Link href="/family" className="zc-card flex min-h-[88px] flex-col p-4">
                <div className="mono text-[10px] uppercase tracking-wide text-muted">🏡 In Zimbabwe</div>
                <div className="disp mt-auto text-[26px] font-extrabold">{d.here.length}</div>
                <div className="text-[13px] font-extrabold text-ink2">of {d.users.length} family</div>
              </Link>
              <Link href="/flights" className="zc-card flex min-h-[88px] flex-col p-4">
                <div className="mono text-[10px] uppercase tracking-wide text-muted">🛬 Arriving today</div>
                <div className="disp mt-auto text-[26px] font-extrabold">{d.arrivingToday.length}</div>
                <div className="text-[13px] font-extrabold text-ink2">{d.arrivingToday[0]?.title ?? "Quiet airport day"}</div>
              </Link>
            </div>
          </div>

          <NeedsMe items={nudges} className="mb-[18px]" />

          <div className="grid grid-cols-[1.12fr_0.88fr] items-start gap-[18px]">
            <div className="flex flex-col gap-[18px]">
              <Panel title="Today" meta="What's happening">
                {d.pinned || d.arrivingToday.length || todayPlans.length ? (
                  <div>
                    {d.pinned && <EventRow icon="📢" title={d.pinned.title} lead="Now" />}
                    {d.arrivingToday.map((t) => <EventRow key={t.id} icon="✈️" title={`${t.title} arrive`} lead={fmtTime(t.arrivalIso)} href={`/flights/${t.id}`} />)}
                    {todayPlans.map((p) => <EventRow key={p.id} icon={categoryOf(p.category).icon} title={p.title} lead={p.start_time ? fmtTime(`${p.date}T${p.start_time}:00+02:00`) : "—"} href={`/plans/${p.id}`} />)}
                  </div>
                ) : <PanelEmpty emoji="🌤️" text="Nothing major today" />}
              </Panel>
              <Panel title="Coming up" meta="Next few days" link={{ label: "Open calendar", href: "/calendar" }}>
                {comingUp.length ? comingUp.map((e, i) => <EventRow key={i} icon={e.icon} title={e.title} lead={fmtDayShortUpper(`${e.date}T00:00:00+02:00`)} href={e.href} />) : <PanelEmpty text="Nothing coming up" />}
              </Panel>
              <Panel title="Who's where" meta={`${d.here.length} in Zimbabwe`}>
                <div className="px-3.5 pb-1"><WhosHere here={d.here} /></div>
              </Panel>
            </div>

            <div className="flex flex-col gap-[18px]">
              <Panel title="In the air" meta={active ? <><LiveDot /> live</> : "0 active"} pad>
                {active ? <FlightCard travel={active} full /> : <PanelEmpty emoji="✈️" text="No family flights in the air right now" />}
              </Panel>
              <Panel title="Arrivals" meta="Flight board">
                {d.travel.filter((t) => t.status !== "arrived").length ? (
                  d.travel.filter((t) => t.status !== "arrived").map((t) => <ArrivalRow key={t.id} t={t} />)
                ) : <PanelEmpty text="No upcoming arrivals" />}
              </Panel>
              <Panel title="Airport pickups" meta={`${d.pickupsOpen.length} runs`}>
                {d.pickupsOpen.length ? (
                  d.pickupsOpen.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 border-b border-line2 px-4 py-3 last:border-0">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-extrabold">{t.members.map((m) => m.emoji).join(" ")} {t.title}</div>
                        <div className="mono text-[10.5px] text-muted">{fmtDayShortUpper(t.arrivalIso)} · {t.activeLeg?.flight_number}</div>
                      </div>
                      <PickupControl travelId={t.id} driver={t.pickup?.driver_user_id ? t.members.find((m) => m.id === t.pickup?.driver_user_id) ?? d.users.find((u) => u.id === t.pickup?.driver_user_id) ?? null : null} meId={me.id} isAdmin={me.is_admin} enRoute={t.pickup?.driver_en_route} />
                    </div>
                  ))
                ) : <PanelEmpty emoji="🚗" text="No pickups needed" />}
              </Panel>
            </div>
          </div>

          <div className="mt-[18px] grid grid-cols-2 gap-[18px] xl:grid-cols-4">
            <Panel title="Shopping" link={{ label: "Open shopping", href: "/shopping" }}>
              {d.shopping.filter((s) => !s.completed).slice(0, 5).map((s) => <ShoppingItemRow key={s.id} item={s} meId={me.id} />)}
              {d.shopping.filter((s) => !s.completed).length === 0 && <PanelEmpty emoji="😎" text="All stocked up" />}
            </Panel>
            <Panel title="Tasks" link={{ label: "Open tasks", href: "/tasks" }}>
              {d.tasks.filter((t) => !t.completed).slice(0, 5).map((t) => <TaskItemRow key={t.id} task={t} meId={me.id} />)}
              {d.tasks.filter((t) => !t.completed).length === 0 && <PanelEmpty emoji="🎉" text="Nothing to do" />}
            </Panel>
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
            <Panel title="Important info" link={{ label: "Open info", href: "/info" }}>
              <div className="px-1">
                {(await getInfoSummary()).map((g) => (
                  <Link key={g.category} href="/info" className="flex items-center justify-between border-b border-line2 px-3 py-3 text-sm last:border-0">
                    <span className="font-extrabold">{g.icon} {g.category}</span>
                    <span className="text-muted">›</span>
                  </Link>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}

// ---- command centre helpers ----
function Panel({ title, meta, link, pad, children }: { title: string; meta?: React.ReactNode; link?: { label: string; href: string }; pad?: boolean; children: React.ReactNode }) {
  return (
    <section className="zc-card flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-[18px] pb-1.5 pt-4">
        <h3 className="disp text-base font-extrabold">{title}</h3>
        {meta && <span className="mono ml-auto flex items-center gap-1.5 text-[10.5px] uppercase tracking-wide text-muted">{meta}</span>}
      </div>
      <div className={pad ? "px-3.5 pb-4 pt-1.5" : "pb-1.5"}>{children}</div>
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
async function getInfoSummary() {
  const { getRepo } = await import("@/lib/repo");
  const groups = await getRepo().listInfo();
  const icon = (c: string) => ({ Emergency: "🚨", "Home / Base": "🏠", Wedding: "💍", Transport: "🚗" })[c] ?? "ℹ️";
  return groups.map((g) => ({ category: g.category, icon: icon(g.category) }));
}
