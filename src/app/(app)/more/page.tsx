import Link from "next/link";
import { getRepo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/identity";
import { Screen } from "@/components/ui";
import { InstallPrompt } from "@/components/install-prompt";

export const dynamic = "force-dynamic";

export default async function MorePage() {
  const repo = getRepo();
  const me = await getCurrentUser();
  const [plans, travel, shopping, tasks, polls] = await Promise.all([
    repo.listPlans(),
    repo.listTravel(),
    repo.listShopping(),
    repo.listTasks(),
    me ? repo.listPolls(me.id) : Promise.resolve([]),
  ]);
  const openPickups = travel.filter((t) => t.pickup?.requested && !t.pickup.driver_user_id).length;
  const openShopping = shopping.filter((s) => !s.completed).length;
  const openTasks = tasks.filter((t) => !t.completed).length;
  const openPolls = polls.filter((p) => !p.closed).length;

  const items: { href: string; icon: string; label: string; badge?: number }[] = [
    { href: "/calendar?view=plans", icon: "📅", label: "Plans", badge: plans.length },
    { href: "/flights", icon: "🚗", label: "Airport pickups", badge: openPickups },
    { href: "/shopping", icon: "🛒", label: "Shopping", badge: openShopping },
    { href: "/tasks", icon: "✅", label: "Tasks", badge: openTasks },
    { href: "/polls", icon: "📊", label: "Polls", badge: openPolls },
    { href: "/info", icon: "ℹ️", label: "Important info" },
    { href: "/activity", icon: "🔔", label: "Activity" },
    ...(me?.is_admin ? [{ href: "/admin", icon: "🛡️", label: "Admin" }] : []),
    { href: "/profile", icon: "👤", label: "Profile & settings" },
  ];

  return (
    <Screen title="More ☰">
      <div className="overflow-hidden rounded-[18px] border border-line">
        {items.map((it) => (
          <Link key={it.href} href={it.href} className="flex items-center gap-3.5 border-b border-line bg-card p-4 last:border-0">
            <span className="w-6 text-center text-xl" aria-hidden>{it.icon}</span>
            <span className="flex-1 text-[15px] font-extrabold">{it.label}</span>
            {it.badge ? <span className="rounded-full bg-honey px-2 py-0.5 text-[11px] font-extrabold text-white">{it.badge}</span> : null}
            <span className="text-muted">›</span>
          </Link>
        ))}
      </div>
      <InstallPrompt />
      <p className="mt-5 text-center text-xs text-muted">Zim 2026 · private family hub</p>
    </Screen>
  );
}
