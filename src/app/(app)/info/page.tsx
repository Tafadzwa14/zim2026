import { getRepo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/identity";
import { List, Screen } from "@/components/ui";

export const dynamic = "force-dynamic";

const ICON: Record<string, string> = { Emergency: "🚨", "Home / Base": "🏠", Wedding: "💍", Transport: "🚗", "Useful Places": "📍" };

export default async function InfoPage() {
  const [groups, me] = await Promise.all([getRepo().listInfo(), getCurrentUser()]);

  return (
    <Screen title="Important info ℹ️">
      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <div key={g.category}>
            <div className="disp mb-2 flex items-center gap-2 text-base font-extrabold">
              <span aria-hidden>{ICON[g.category] ?? "ℹ️"}</span> {g.category}
            </div>
            <List>
              {g.items.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 border-b border-line2 px-4 py-3 text-sm last:border-0">
                  <span className="font-bold text-muted">{r.title}</span>
                  <span className="text-right font-extrabold">{r.content}</span>
                </div>
              ))}
            </List>
          </div>
        ))}
      </div>
      {me?.is_admin && <p className="mt-4 text-xs text-muted">You&apos;re an admin — edit important info from the Admin area.</p>}
    </Screen>
  );
}
