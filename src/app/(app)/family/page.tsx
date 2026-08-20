import { getRepo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/identity";
import { EmptyState, List, Screen, StatusPill } from "@/components/ui";
import { ROLES } from "@/lib/types";

export const dynamic = "force-dynamic";

const ORDER = { here: 0, travelling: 1, upcoming: 2 } as const;

export default async function FamilyPage() {
  const me = await getCurrentUser();
  if (!me?.is_admin) return <Screen title="Family 👥"><EmptyState emoji="🔒" title="Admins only" hint="The family list is visible to admins." /></Screen>;

  const users = await getRepo().listUsers();
  const sorted = [...users].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name));
  const here = users.filter((u) => u.status === "here").length;

  return (
    <Screen title="Family 👥" sub={`${users.length} people · ${here} in Zimbabwe`}>
      <List>
        {sorted.map((u) => {
          const roleLabels = ROLES.filter((r) => u.roles.includes(r.slug));
          return (
            <div key={u.id} className="flex items-center gap-3.5 border-b border-line2 px-4 py-3.5 last:border-0">
              <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-chip text-2xl" aria-hidden>{u.emoji}</span>
              <div className="min-w-0">
                <div className="text-[15px] font-extrabold">
                  {u.name}
                  {u.is_admin && <span className="mono ml-1.5 text-[10px] text-honey">ADMIN</span>}
                </div>
                <div className="mono text-[11px] text-muted">@{u.username}</div>
                {(roleLabels.length > 0 || u.staying_at) && (
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {roleLabels.map((r) => (
                      <span key={r.slug} className="rounded-full bg-chip px-2 py-0.5 text-[10px] font-bold text-ink2">{r.emoji} {r.label}</span>
                    ))}
                    {u.staying_at && <span className="text-[11px] text-muted">📍 {u.staying_at}</span>}
                  </div>
                )}
              </div>
              {u.status !== "here" && (
                <span className="ml-auto flex-none">
                  {u.status === "travelling" ? <StatusPill tone="air">In the air</StatusPill> : <StatusPill tone="up">Arriving</StatusPill>}
                </span>
              )}
            </div>
          );
        })}
      </List>
    </Screen>
  );
}
