import { Fragment } from "react";
import Link from "next/link";
import { getDashboard } from "@/lib/dashboard";
import { getCurrentUser } from "@/lib/identity";
import { getRepo } from "@/lib/repo";
import { categoryOf } from "@/lib/display";
import { fmtWeekdayLong } from "@/lib/format";
import { ThemeToggle } from "@/components/providers";
import { resolveLayout, surfaceLayout } from "@/lib/home-layout";
import {
  MyBanner,
  MyStatTile,
  NeedsMe,
  needsMe,
  renderDesktopWidget,
  renderMobileWidget,
  type HomeCtx,
} from "@/components/home/widgets";

export const dynamic = "force-dynamic";

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
  const active = d.active[0]?.activeLeg ? d.active[0] : null;
  const nudges = needsMe(d, me);
  const todayPlans = d.plans.filter((p) => p.date === d.today);
  const comingUp = [
    ...d.comingNext.map((t) => ({ date: t.arrivalIso?.slice(0, 10) ?? "", icon: "✈️", title: `${t.title} arrive`, href: `/flights/${t.id}` })),
    ...d.plans.filter((p) => p.date > d.today).map((p) => ({ date: p.date, icon: categoryOf(p.category).icon, title: p.title, href: `/plans/${p.id}` })),
  ].filter((e) => e.date).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);

  const ctx: HomeCtx = { d, me, active, todayPlans, comingUp, infoSummary, photos };

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
              <div className="mono mt-1 text-xs uppercase tracking-wide text-muted">{fmtWeekdayLong(new Date())}</div>
            </div>
            <div className="grid min-w-[520px] flex-1 grid-cols-3 gap-3">
              <MyStatTile d={d} me={me} />
              <Link href="/flights" className="zc-card flex min-h-[88px] flex-col p-4">
                <div className="mono text-[10px] uppercase tracking-wide text-muted">✈️ In the air</div>
                <div className="disp mt-auto text-[26px] font-extrabold">{active ? active.activeLeg!.flight_number : "0"}</div>
                <div className="text-[13px] font-extrabold text-ink2">{active ? "In the air" : "None active"}</div>
              </Link>
              <Link href="/flights" className="zc-card flex min-h-[88px] flex-col p-4">
                <div className="mono text-[10px] uppercase tracking-wide text-muted">🛬 Arriving today</div>
                <div className="disp mt-auto text-[26px] font-extrabold">{d.arrivingToday.length}</div>
                <div className="text-[13px] font-extrabold text-ink2">{d.arrivingToday[0]?.title ?? "Quiet airport day"}</div>
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
