import { getRepo } from "@/lib/repo";
import { timeAgo } from "@/lib/format";
import { EmptyState, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const activity = await getRepo().listActivity(50);
  if (!activity.length) return <Screen title="Activity 🔔"><EmptyState emoji="🔔" title="Nothing yet" /></Screen>;

  return (
    <Screen title="Activity 🔔">
      <div className="zc-card px-4 py-1">
        {activity.map((a) => (
          <div key={a.id} className="flex gap-3 border-b border-line2 py-3.5 last:border-0">
            <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-chip text-xl" aria-hidden>{a.actor?.emoji ?? "👤"}</span>
            <div>
              <div className="text-sm font-semibold leading-snug"><b>{a.actor?.name ?? "Someone"}</b> {(a.metadata as { text?: string })?.text}</div>
              <div className="mono mt-0.5 text-[10.5px] text-muted">{timeAgo(a.created_at)}</div>
            </div>
          </div>
        ))}
      </div>
    </Screen>
  );
}
