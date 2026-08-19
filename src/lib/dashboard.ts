import "server-only";

import { getRepo } from "@/lib/repo";
import { tripDateOf, tripTodayISO } from "@/lib/format";

/** One aggregated read for Home / the command centre (spec section 45). */
export async function getDashboard() {
  const repo = getRepo();
  const [settings, users, travel, plans, announcements, shopping, tasks, activity] = await Promise.all([
    repo.getSettings(),
    repo.listUsers(),
    repo.listTravel(),
    repo.listPlans(),
    repo.listAnnouncements(),
    repo.listShopping(),
    repo.listTasks(),
    repo.listActivity(8),
  ]);
  const today = tripTodayISO();
  const arrivingToday = travel.filter((t) => t.status !== "arrived" && t.arrivalIso && tripDateOf(t.arrivalIso) === today);
  const active = travel.filter((t) => t.status === "travelling");
  const here = users.filter((u) => u.status === "here");
  const comingNext = travel.filter((t) => t.status === "upcoming");
  const dinner = plans.find((p) => p.category === "dinner" && p.date === today) ?? null;
  const pinned = announcements.find((a) => a.is_pinned) ?? null;
  const pickupsOpen = travel.filter((t) => t.pickup?.requested);

  return {
    settings, users, travel, plans, announcements, shopping, tasks, activity,
    today, arrivingToday, active, here, comingNext, dinner, pinned, pickupsOpen,
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
