"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { CatPill, EmptyState, List } from "@/components/ui";
import { PlanJoinButton } from "@/components/interactive";
import { categoryOf, GOGO_BIRTHDAY } from "@/lib/display";
import { fmtTime } from "@/lib/format";
import type { PlanView } from "@/lib/repo/types";

export type CalKind = "plan" | "travel" | "pickup" | "wedding" | "birthday";

export interface CalEvent {
  id: string;
  kind: CalKind;
  date: string; // YYYY-MM-DD (trip tz)
  time: string | null; // HH:mm (24h) or null
  icon: string;
  title: string;
  href?: string;
  // plan-only enrichment
  planId?: string;
  anyoneCanJoin?: boolean;
  attendeeEmojis?: string[];
  attendeeIds?: string[];
}

type ViewKey = "agenda" | "month" | "plans";

const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "agenda", label: "Agenda" },
  { key: "month", label: "Month" },
  { key: "plans", label: "Plans" },
];

const FILTERS: { key: CalKind; label: string; icon: string }[] = [
  { key: "plan", label: "Plans", icon: "📋" },
  { key: "travel", label: "Travel", icon: "✈️" },
  { key: "pickup", label: "Pickups", icon: "🚗" },
  { key: "wedding", label: "Wedding", icon: "💍" },
  { key: "birthday", label: "Birthday", icon: "🎂" },
];

function dayLabel(date: string) {
  return new Date(`${date}T00:00:00+02:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Africa/Harare",
  });
}

function timeLabel(time: string | null) {
  if (!time) return "—";
  return fmtTime(`2026-01-01T${time}:00+02:00`);
}

export function CalendarView({
  events,
  plans,
  meId,
  today,
  wedding,
  initialView = "agenda",
}: {
  events: CalEvent[];
  plans: PlanView[];
  meId: string;
  today: string;
  wedding: { date: string; url: string | null };
  initialView?: ViewKey;
}) {
  const [view, setView] = useState<ViewKey>(initialView);
  const [off, setOff] = useState<Set<CalKind>>(new Set());

  const shown = useMemo(() => events.filter((e) => !off.has(e.kind)), [events, off]);
  const toggle = (k: CalKind) => setOff((prev) => {
    const next = new Set(prev);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    return next;
  });

  return (
    <div>
      {/* view switch */}
      <div className="mb-3 flex gap-1.5 rounded-2xl bg-chip p-1">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={cn(
              "flex-1 rounded-xl py-2 text-center text-[13px] font-extrabold",
              view === v.key ? "bg-card text-ink shadow-sm" : "text-ink2"
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* filter chips (agenda + month only) */}
      {view !== "plans" && (
        <div className="mb-3.5 flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const on = !off.has(f.key);
            return (
              <button
                key={f.key}
                onClick={() => toggle(f.key)}
                aria-pressed={on}
                className={cn(
                  "flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-[12px] font-extrabold",
                  on ? "border-honey bg-[color-mix(in_srgb,var(--honey)_14%,transparent)] text-honey" : "border-line bg-card text-muted"
                )}
              >
                <span aria-hidden>{f.icon}</span>
                {f.label}
              </button>
            );
          })}
        </div>
      )}

      {view === "agenda" && <Agenda events={shown} meId={meId} today={today} />}
      {view === "month" && <Month events={shown} today={today} />}
      {view === "plans" && <Plans plans={plans} meId={meId} today={today} />}

      {view !== "month" && !off.has("wedding") && (
        <a
          href={wedding.url || "#"}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex items-center gap-3.5 rounded-[22px] p-[18px] text-white"
          style={{ background: "var(--grad-wed)" }}
        >
          <span className="text-2xl" aria-hidden>💍</span>
          <span>
            <span className="text-[11px] font-extrabold uppercase tracking-wide opacity-90">{dayLabel(wedding.date)}</span>
            <span className="disp block text-xl font-extrabold">Wedding / Roora</span>
          </span>
          <span className="ml-auto text-2xl opacity-90" aria-hidden>›</span>
        </a>
      )}

      {view !== "month" && !off.has("birthday") && (
        <div
          className="mt-3 flex items-center gap-3.5 rounded-[22px] p-[18px] text-white"
          style={{ background: "var(--grad-onboard)" }}
        >
          <span className="text-2xl" aria-hidden>🎂</span>
          <span>
            <span className="text-[11px] font-extrabold uppercase tracking-wide opacity-90">{dayLabel(GOGO_BIRTHDAY.date)}</span>
            <span className="disp block text-xl font-extrabold">{GOGO_BIRTHDAY.title}</span>
          </span>
        </div>
      )}
    </div>
  );
}

function AgendaRow({ e, meId }: { e: CalEvent; meId: string }) {
  const going = !!e.attendeeIds?.includes(meId);
  const core = (
    <>
      <span className="mono flex-none text-xs font-semibold text-muted">{timeLabel(e.time)}</span>
      <span className="text-lg" aria-hidden>{e.icon}</span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-extrabold">{e.title}</span>
    </>
  );

  if (e.kind === "plan" && e.planId) {
    return (
      <div className="flex items-center gap-3 border-b border-line2 px-4 py-3 last:border-0">
        <Link href={e.href ?? `/plans/${e.planId}`} className="flex min-w-0 flex-1 items-center gap-3">{core}</Link>
        <div className="flex flex-none items-center gap-1.5">
          {e.attendeeEmojis?.slice(0, 4).map((em, i) => <span key={i} className="text-base" aria-hidden>{em}</span>)}
          {e.anyoneCanJoin && <PlanJoinButton planId={e.planId} going={going} />}
        </div>
      </div>
    );
  }

  const inner = <div className="flex items-center gap-3 border-b border-line2 px-4 py-3 last:border-0">{core}</div>;
  return e.href ? <Link href={e.href} className="block">{inner}</Link> : inner;
}

function AgendaGroups({ dates, groups, meId }: { dates: string[]; groups: Record<string, CalEvent[]>; meId: string }) {
  return (
    <div className="flex flex-col gap-4">
      {dates.map((date) => (
        <div key={date}>
          <div className="mono mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">{dayLabel(date)}</div>
          <List>
            {groups[date].map((e) => <AgendaRow key={e.id} e={e} meId={meId} />)}
          </List>
        </div>
      ))}
    </div>
  );
}

function Agenda({ events, meId, today }: { events: CalEvent[]; meId: string; today: string }) {
  const upcoming = events.filter((e) => e.date >= today);
  const earlier = events.filter((e) => e.date < today);

  const group = (list: CalEvent[]) => {
    const g: Record<string, CalEvent[]> = {};
    list.forEach((e) => (g[e.date] ??= []).push(e));
    return { g, dates: Object.keys(g).sort() };
  };
  const up = group(upcoming);
  const past = group(earlier);

  if (!events.length) return <EmptyState emoji="🗓️" title="Nothing on the calendar yet" hint="Tap + to add a plan." />;

  return (
    <div className="flex flex-col gap-4">
      {up.dates.length > 0 ? (
        <AgendaGroups dates={up.dates} groups={up.g} meId={meId} />
      ) : (
        <EmptyState emoji="🌤️" title="Nothing coming up" hint="Everything shown is in the past." />
      )}

      {past.dates.length > 0 && (
        <details className="group">
          <summary className="mono flex cursor-pointer items-center gap-2 py-1 text-[12px] font-semibold uppercase tracking-wide text-muted">
            <span className="transition-transform group-open:rotate-90" aria-hidden>›</span>
            Earlier ({earlier.length})
          </summary>
          <div className="mt-3">
            <AgendaGroups dates={past.dates.reverse()} groups={past.g} meId={meId} />
          </div>
        </details>
      )}
    </div>
  );
}

function Month({ events, today }: { events: CalEvent[]; today: string }) {
  // Default focus: month of the first upcoming event, else current month.
  const firstUpcoming = events.filter((e) => e.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const [ty, tm] = today.split("-").map(Number);
  const initial = (firstUpcoming ?? { date: today }).date.split("-").map(Number);
  const [cursor, setCursor] = useState<{ y: number; m: number }>({ y: initial[0], m: initial[1] });

  const step = (delta: number) => setCursor((c) => {
    const idx = c.y * 12 + (c.m - 1) + delta;
    return { y: Math.floor(idx / 12), m: (idx % 12) + 1 };
  });

  const { y, m } = cursor;
  const first = new Date(Date.UTC(y, m - 1, 1));
  const start = first.getUTCDay();
  const dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const monthName = first.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  const byDay: Record<number, CalEvent[]> = {};
  events.forEach((e) => {
    const [ey, em, ed] = e.date.split("-").map(Number);
    if (ey === y && em === m) (byDay[ed] ??= []).push(e);
  });

  const isTodayMonth = y === ty && m === tm;
  const todayDay = Number(today.split("-")[2]);
  const cells: (number | null)[] = [...Array(start).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button onClick={() => step(-1)} aria-label="Previous month" className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-card text-lg text-ink2">‹</button>
        <div className="disp text-[15px] font-extrabold">{monthName}</div>
        <button onClick={() => step(1)} aria-label="Next month" className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-card text-lg text-ink2">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="py-0.5 text-center text-[10px] font-extrabold text-muted">{d}</div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div key={i} />;
          const ev = byDay[d] ?? [];
          const isT = isTodayMonth && d === todayDay;
          return (
            <div key={i} className={cn("flex aspect-square flex-col rounded-xl border p-1.5", isT ? "border-honey bg-[color-mix(in_srgb,var(--honey)_16%,transparent)]" : "border-line bg-card")}>
              <div className={cn("text-[11px] font-extrabold", isT && "text-honey")}>{d}</div>
              <div className="mt-auto flex flex-wrap gap-px text-[9px]">
                {ev.slice(0, 3).map((e, j) => <span key={j} aria-hidden>{e.icon}</span>)}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted">Dots show travel, plans, pickups and the wedding. Switch to Agenda for detail.</p>
    </div>
  );
}

function Plans({ plans, meId, today }: { plans: PlanView[]; meId: string; today: string }) {
  if (!plans.length) return <EmptyState emoji="📅" title="Nothing planned yet" hint="Tap + to add a plan." />;

  const sorted = [...plans].sort((a, b) => (a.date + (a.start_time ?? "")).localeCompare(b.date + (b.start_time ?? "")));
  const upcoming = sorted.filter((p) => p.date >= today);
  const past = sorted.filter((p) => p.date < today);

  return (
    <div className="flex flex-col gap-5">
      {upcoming.length > 0 && <PlanGrid plans={upcoming} meId={meId} />}
      {upcoming.length === 0 && <EmptyState emoji="🌤️" title="No upcoming plans" hint="Everything planned is in the past." />}
      {past.length > 0 && (
        <details className="group">
          <summary className="mono flex cursor-pointer items-center gap-2 py-1 text-[12px] font-semibold uppercase tracking-wide text-muted">
            <span className="transition-transform group-open:rotate-90" aria-hidden>›</span>
            Earlier ({past.length})
          </summary>
          <div className="mt-3"><PlanGrid plans={past} meId={meId} /></div>
        </details>
      )}
    </div>
  );
}

function PlanGrid({ plans, meId }: { plans: PlanView[]; meId: string }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {plans.map((p) => {
        const c = categoryOf(p.category);
        const going = p.attendees.some((a) => a.id === meId);
        return (
          <div key={p.id} className="zc-card p-4">
            <Link href={`/plans/${p.id}`} className="block">
              <div className="flex items-start justify-between gap-2.5">
                <div>
                  <div className="disp text-[17px] font-extrabold">{p.title}</div>
                  <div className="mono mt-0.5 text-[11px] text-muted">
                    {dayLabel(p.date).toUpperCase()} {p.start_time ? `· ${timeLabel(p.start_time)}` : "· TIME TBC"} {p.location ? `· ${p.location}` : ""}
                  </div>
                </div>
                <CatPill icon={c.icon} label={c.label} />
              </div>
            </Link>
            <div className="mt-3 flex items-center gap-1.5">
              <span className="mono mr-1 text-[11px] font-bold text-muted">{p.attendees.length} going</span>
              {p.attendees.slice(0, 5).map((a) => <span key={a.id} className="text-lg" aria-hidden>{a.emoji}</span>)}
              {p.attendees.length > 5 && <span className="mono text-[11px] text-muted">+{p.attendees.length - 5}</span>}
              {p.anyone_can_join && <PlanJoinButton planId={p.id} going={going} className="ml-auto" />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
