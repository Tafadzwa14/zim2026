import { getRepo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/identity";
import { categoryOf, GOGO_BIRTHDAY } from "@/lib/display";
import { fmtTime24, tripDateOf, tripTodayISO } from "@/lib/format";
import { Screen } from "@/components/ui";
import { CalendarView, type CalEvent } from "@/components/calendar-view";

export const dynamic = "force-dynamic";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const initialView = view === "month" || view === "plans" ? view : "agenda";
  const repo = getRepo();
  const [plans, travel, settings, me] = await Promise.all([
    repo.listPlans(),
    repo.listTravel(),
    repo.getSettings(),
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

  travel.forEach((t) => {
    if (!t.arrivalIso) return;
    const date = tripDateOf(t.arrivalIso);
    evs.push({ id: `travel-${t.id}`, kind: "travel", date, time: fmtTime24(t.arrivalIso), icon: "✈️", title: `${t.title} arrive`, href: `/flights/${t.id}` });
    if (t.pickup?.requested) {
      evs.push({ id: `pickup-${t.id}`, kind: "pickup", date, time: fmtTime24(t.arrivalIso), icon: "🚗", title: `Airport pickup — ${t.title}`, href: `/flights/${t.id}` });
    }
  });

  evs.push({ id: "wedding", kind: "wedding", date: settings.wedding_date, time: "11:00", icon: "💍", title: "Wedding / Roora" });
  evs.push({ id: "birthday", kind: "birthday", date: GOGO_BIRTHDAY.date, time: GOGO_BIRTHDAY.time, icon: GOGO_BIRTHDAY.icon, title: GOGO_BIRTHDAY.title });
  evs.sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));

  return (
    <Screen title="Calendar 📅">
      <CalendarView
        events={evs}
        plans={plans}
        meId={me.id}
        today={tripTodayISO()}
        wedding={{ date: settings.wedding_date, url: settings.wedding_url }}
        initialView={initialView}
      />
    </Screen>
  );
}
