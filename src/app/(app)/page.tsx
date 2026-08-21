import { Fragment } from "react";
import Link from "next/link";
import { getDashboard } from "@/lib/dashboard";
import { getCurrentUser } from "@/lib/identity";
import { getRepo } from "@/lib/repo";
import { categoryOf } from "@/lib/display";
import { fmtWeekdayLong, tripDateOf } from "@/lib/format";
import { myFlightTrip } from "@/lib/travel";
import { ThemeToggle } from "@/components/providers";
import { resolveLayout, surfaceLayout } from "@/lib/home-layout";
import type { TaskView } from "@/lib/repo/types";
import {
  airborneLeg,
  MyBanner,
  MyStatTile,
  NeedsMe,
  needsMe,
  renderDesktopWidget,
  renderMobileWidget,
  type HomeCtx,
} from "@/components/home/widgets";

export const dynamic = "force-dynamic";

/** Sort key for a person's task list: soonest due first, undated last. */
function dueKey(t: TaskView): string {
  return t.due_date ? `${t.due_date}T${t.due_time ?? "23:59"}` : "9999-12-31";
}

async function getInfoSummary() {
  const groups = await getRepo().listInfo();
  const icon = (c: string) => ({ Emergency: "🚨", "Home / Base": "🏠", Wedding: "💍", Transport: "🚗" })[c] ?? "ℹ️";
  return groups.map((g) => ({ category: g.category, icon: icon(g.category) }));
}

export default async function HomePage() {
  const [d, me, allPhotos, infoSummary] = await Promise.all([
    getDashboard(),
    getCurrentUser(),
    getRepo().listPhotos(),
    getInfoSummary(),
  ]);
  if (!me) return null;

  const photos = allPhotos.slice(0, 12);
  // Every group with a leg genuinely in the air right now, and more than one can
  // be, so we surface all of them. `activeLeg` falls back to the last leg and so
  // never goes null, which is why it can't be the test here.
  const activeFlights = d.travel.filter((t) => airborneLeg(t));
  const soloLeg = activeFlights.length === 1 ? airborneLeg(activeFlights[0]) : null;
  // The viewer's own trip, and the jobs sitting with them.
  const myFlight = myFlightTrip(d.travel, me.id);
  const myTasks = d.tasks.filter((t) => !t.completed && t.assigned_to === me.id).sort((a, b) => dueKey(a).localeCompare(dueKey(b)));
  const nudges = needsMe(d, me);
  const todayPlans = d.plans.filter((p) => p.date === d.today);
  // The runs tile counts every run today; its sub names the next one still to come.
  const nextRunToday = d.runsAhead.find((r) => tripDateOf(r.hreIso) === d.today) ?? null;
  // Days ahead: runs still to come, on a later date than today, each read by
  // direction and dated from the run instant itself so a late-night landing
  // lands on the right day. Today's runs belong to the Today panel.
  const comingUp = [
    ...d.runsAhead
      .filter((r) => tripDateOf(r.hreIso) > d.today)
      .map((r) => ({
        date: tripDateOf(r.hreIso),
        icon: r.kind === "pickup" ? "🛬" : "🛫",
        title: r.cancelled
          ? `${r.trip.title} ${r.kind === "pickup" ? "arrival" : "departure"} cancelled`
          : `${r.trip.title} ${r.kind === "pickup" ? "arrive" : "fly out"}`,
        href: `/flights/${r.tripId}`,
      })),
    ...d.plans.filter((p) => p.date > d.today).map((p) => ({ date: p.date, icon: categoryOf(p.category).icon, title: p.title, href: `/plans/${p.id}` })),
  ].filter((e) => e.date).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);

  const ctx: HomeCtx = { d, me, activeFlights, myFlight, myTasks, todayPlans, comingUp, infoSummary, photos };

  // Each person's chosen order + hidden set, merged with the current defaults.
  const mobileWidgets = resolveLayout("mobile", surfaceLayout(me.prefs, "mobile")).filter((w) => w.visible);
  const desktopWidgets = resolveLayout("desktop", surfaceLayout(me.prefs, "desktop")).filter((w) => w.visible);

  return (
    <>
      {/* ============ MOBILE HOME ============ */}
      <div className="px-[18px] md:mx-auto md:max-w-4xl lg:hidden">
        <header className="sticky top-0 z-20 -mx-[18px] flex items-start justify-between gap-2.5 bg-paper px-[18px] pb-2.5 pt-4">
          <div>
            <h1 className="disp text-[26px] font-extrabold tracking-tight">{d.settings.app_title}</h1>
            <div className="mono mt-0.5 text-[11px] uppercase tracking-wide text-muted">{fmtWeekdayLong(new Date())} · Harare</div>
          </div>
          <div className="flex items-center gap-2">
            {me.is_admin && <Link href="/admin" className="rounded-full bg-ink px-3 py-[7px] text-[11px] font-extrabold text-paper">🛡️ Admin</Link>}
            <ThemeToggle className="flex h-10 w-10 items-center justify-center rounded-[13px] border border-line bg-card text-lg" />
            <Link href="/profile" className="flex h-10 w-10 items-center justify-center rounded-[13px] border border-line bg-card text-lg">{me.emoji}</Link>
          </div>
        </header>
        {/* Weather sits here, out of the sticky header, so it can wrap without
            burying the screen behind a four-line header. Not a widget. */}
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2.5">
          <span className="disp text-lg font-bold">The crew is assembling ✈️</span>
          {d.weather && (
            <span className="mono text-[11px] uppercase tracking-wide text-muted">
              {d.weather.emoji} Harare · {d.weather.label} · {d.weather.min}°–{d.weather.max}°
            </span>
          )}
        </div>
        <MyBanner d={d} />
        <NeedsMe items={nudges} className="mt-3" />

        <div>
          {mobileWidgets.map((w) => <Fragment key={w.id}>{renderMobileWidget(w.id, ctx)}</Fragment>)}
        </div>
      </div>

      {/* ============ DESKTOP COMMAND CENTRE ============ */}
      <div className="hidden px-8 pt-7 lg:block">
        <div className="mx-auto max-w-[1320px]">
          <div className="mb-5 flex flex-wrap items-center gap-6">
            <div>
              <h1 className="disp text-3xl font-extrabold tracking-tight">{d.settings.app_title}</h1>
              <div className="mono mt-1 text-xs uppercase tracking-wide text-muted">{fmtWeekdayLong(new Date())} · Harare</div>
            </div>
            <div className="grid min-w-[520px] flex-1 grid-cols-3 gap-3">
              <MyStatTile d={d} />
              <Link href="/flights" className="zc-card flex min-h-[88px] flex-col p-4">
                <div className="mono text-[10px] uppercase tracking-wide text-muted">✈️ In the air</div>
                <div className="disp mt-auto text-[26px] font-extrabold">{soloLeg ? soloLeg.flight_number : activeFlights.length}</div>
                <div className="text-[13px] font-extrabold text-ink2">{activeFlights.length ? "In the air" : "None active"}</div>
              </Link>
              <Link href="/flights" className="zc-card flex min-h-[88px] flex-col p-4">
                <div className="mono text-[10px] uppercase tracking-wide text-muted">🚗 Airport runs today</div>
                <div className="disp mt-auto text-[26px] font-extrabold">{d.runsToday.length}</div>
                <div className="truncate text-[13px] font-extrabold text-ink2">
                  {nextRunToday
                    ? `${nextRunToday.kind === "pickup" ? "Pickup" : "Drop-off"} · ${nextRunToday.trip.title}${nextRunToday.cancelled ? " · cancelled" : ""}`
                    : d.runsToday.length ? "All done for today" : "Quiet airport day"}
                </div>
              </Link>
            </div>
          </div>

          <NeedsMe items={nudges} className="mb-[18px]" />

          {/* Widgets flow in the viewer's chosen order across a masonry of panels. */}
          <div className="[column-gap:18px] lg:columns-2 2xl:columns-3">
            {desktopWidgets.map((w) => (
              <div key={w.id} className="mb-[18px] break-inside-avoid">{renderDesktopWidget(w.id, ctx)}</div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
