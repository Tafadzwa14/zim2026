import Link from "next/link";
import { getRepo } from "@/lib/repo";
import { categoryOf } from "@/lib/display";
import { fmtTime, fmtTime24, tripDateOf, tripTodayISO } from "@/lib/format";
import { EmptyState, List, Screen } from "@/components/ui";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

interface Ev { date: string; time: string | null; icon: string; title: string; href?: string }

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view = "agenda" } = await searchParams;
  const repo = getRepo();
  const [plans, travel, settings] = await Promise.all([repo.listPlans(), repo.listTravel(), repo.getSettings()]);

  const evs: Ev[] = [];
  plans.forEach((p) => evs.push({ date: p.date, time: p.start_time, icon: categoryOf(p.category).icon, title: p.title, href: `/plans/${p.id}` }));
  travel.forEach((t) => {
    if (!t.arrivalIso) return;
    const date = tripDateOf(t.arrivalIso);
    evs.push({ date, time: fmtTime24(t.arrivalIso), icon: "✈️", title: `${t.title} arrive`, href: `/flights/${t.id}` });
    if (t.pickup?.requested) evs.push({ date, time: fmtTime24(t.arrivalIso), icon: "🚗", title: `Airport pickup — ${t.title}` });
  });
  evs.push({ date: settings.wedding_date, time: "11:00", icon: "💍", title: "Wedding / Roora" });
  evs.sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));

  const today = tripTodayISO();
  const tabs = ["agenda", "month", "day"] as const;

  return (
    <Screen title="Calendar 📅">
      <div className="mb-3.5 flex gap-1.5 rounded-2xl bg-chip p-1">
        {tabs.map((v) => (
          <Link key={v} href={`/calendar?view=${v}`} className={cn("flex-1 rounded-xl py-2 text-center text-[13px] font-extrabold capitalize", view === v ? "bg-card text-ink shadow-sm" : "text-ink2")}>{v}</Link>
        ))}
      </div>

      {view === "agenda" && <Agenda evs={evs} />}
      {view === "day" && <Day evs={evs.filter((e) => e.date === today)} />}
      {view === "month" && <Month evs={evs} today={today} />}

      {view !== "month" && (
        <a href={settings.wedding_url || "#"} target="_blank" rel="noreferrer" className="mt-4 flex items-center gap-3.5 rounded-[22px] p-[18px] text-white" style={{ background: "linear-gradient(115deg,#e0863a,#d9822b 42%,#c74471)" }}>
          <span className="text-2xl" aria-hidden>💍</span>
          <span><span className="text-[11px] font-extrabold uppercase tracking-wide opacity-90">12 September</span><span className="disp block text-xl font-extrabold">Wedding / Roora</span></span>
          <span className="ml-auto text-2xl opacity-90" aria-hidden>›</span>
        </a>
      )}
    </Screen>
  );
}

function Agenda({ evs }: { evs: Ev[] }) {
  const groups: Record<string, Ev[]> = {};
  evs.forEach((e) => (groups[e.date] ??= []).push(e));
  const dates = Object.keys(groups).sort();
  if (!dates.length) return <EmptyState emoji="🗓️" title="Nothing on the calendar yet" />;
  return (
    <div className="flex flex-col gap-4">
      {dates.map((date) => (
        <div key={date}>
          <div className="mono mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">
            {new Date(`${date}T00:00:00+02:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Harare" })}
          </div>
          <List>
            {groups[date].map((e, i) => {
              const inner = (
                <div className="flex items-center gap-3 border-b border-line2 px-4 py-3 last:border-0">
                  <span className="mono flex-none text-xs font-semibold text-muted">{e.time ?? "—"}</span>
                  <span className="text-lg" aria-hidden>{e.icon}</span>
                  <span className="text-[15px] font-extrabold">{e.title}</span>
                </div>
              );
              return e.href ? <Link key={i} href={e.href} className="block">{inner}</Link> : <div key={i}>{inner}</div>;
            })}
          </List>
        </div>
      ))}
    </div>
  );
}

function Day({ evs }: { evs: Ev[] }) {
  if (!evs.length) return <EmptyState emoji="🌤️" title="Nothing scheduled today" />;
  return (
    <List>
      {evs.map((e, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-line2 px-4 py-3 last:border-0">
          <span className="mono flex-none text-xs font-semibold text-muted">{e.time ?? "—"}</span>
          <span className="text-lg" aria-hidden>{e.icon}</span>
          <span className="text-[15px] font-extrabold">{e.title}</span>
        </div>
      ))}
    </List>
  );
}

function Month({ evs, today }: { evs: Ev[]; today: string }) {
  const [y, m] = today.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = first.getUTCDay();
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const byDay: Record<number, Ev[]> = {};
  evs.forEach((e) => {
    const [ey, em, ed] = e.date.split("-").map(Number);
    if (ey === y && em === m) (byDay[ed] ??= []).push(e);
  });
  const todayDay = Number(today.split("-")[2]);
  const monthName = first.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const cells: (number | null)[] = [...Array(start).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
  return (
    <div>
      <div className="disp mb-2 text-[15px] font-extrabold">{monthName}</div>
      <div className="grid grid-cols-7 gap-1.5">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="py-0.5 text-center text-[10px] font-extrabold text-muted">{d}</div>)}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const ev = byDay[d] ?? [];
          const isT = d === todayDay;
          return (
            <div key={i} className={cn("flex aspect-square flex-col rounded-xl border p-1.5", isT ? "border-honey bg-[#fbecd8] dark:bg-[color-mix(in_srgb,var(--honey)_16%,transparent)]" : "border-line bg-card")}>
              <div className={cn("text-[11px] font-extrabold", isT && "text-honey")}>{d}</div>
              <div className="mt-auto flex flex-wrap gap-px text-[9px]">{ev.slice(0, 3).map((e, j) => <span key={j} aria-hidden>{e.icon}</span>)}</div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted">Dots show travel, plans, dinners and the wedding. Tap Agenda for detail.</p>
    </div>
  );
}
