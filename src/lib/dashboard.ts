import "server-only";

import { getRepo } from "@/lib/repo";
import { tripDateOf, tripTodayISO } from "@/lib/format";
import { airportRuns, runIsPast } from "@/lib/travel";
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
  // Every car run to or from Harare airport, soonest first, in the two shapes
  // the home screen needs. `runsToday` is everything on today's date including
  // runs already done, which is what the desktop Today panel wants; `runsAhead`
  // is every run still to come, which is what a "next run" hero, banner or stat
  // tile must read from so a finished run is never presented as next.
  const runs = airportRuns(travel);
  const runsToday = runs.filter((r) => tripDateOf(r.hreIso) === today);
  const runsAhead = runs.filter((r) => !runIsPast(r));

  return {
    settings, users, travel, plans, announcements, shopping, tasks, activity,
    today, here, dinner, pinned,
    runsToday, runsAhead, weather,
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
