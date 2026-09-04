import "server-only";

import { getRepo } from "@/lib/repo";
import { tripDateOf, tripTodayISO } from "@/lib/format";
import { upcomingAirportRuns } from "@/lib/travel";
import { getArrivalWeather } from "@/lib/weather";

/** One aggregated read for Home / the command centre (spec section 45). */
export async function getDashboard() {
  const repo = getRepo();
  const [settings, users, travel, plans, announcements, shopping, tasks, activity, weather] = await Promise.all([
    repo.getSettings(),
    repo.listUsers(),
    repo.listTravel(),
    repo.listPlans(),
    repo.listAnnouncements(),
    repo.listShopping(),
    repo.listTasks(),
    repo.listActivity(8),
    getArrivalWeather("Harare", tripTodayISO()),
  ]);
  const today = tripTodayISO();
  const here = users.filter((u) => u.status === "here");
  const dinner = plans.find((p) => p.category === "dinner" && p.date === today) ?? null;
  const nowIso = new Date().toISOString();
  const pinned = announcements.find((a) => a.is_pinned && (!a.expires_at || a.expires_at > nowIso)) ?? null;
  // Airport runs are always the live queue: completed runs do not linger in
  // the Today panel or compete with the next driver job.
  const runsAhead = upcomingAirportRuns(travel);
  const runsToday = runsAhead.filter((r) => tripDateOf(r.hreIso) === today);

  return {
    settings, users, travel, plans, announcements, shopping, tasks, activity,
    today, here, dinner, pinned,
    runsToday, runsAhead, weather,
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
