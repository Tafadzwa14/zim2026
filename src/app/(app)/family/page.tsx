import { getRepo } from "@/lib/repo";
import { List, Screen, StatusPill } from "@/components/ui";

export const dynamic = "force-dynamic";

const ORDER = { here: 0, travelling: 1, upcoming: 2 } as const;

export default async function FamilyPage() {
  const users = await getRepo().listUsers();
  const sorted = [...users].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name));
  const here = users.filter((u) => u.status === "here").length;

  return (
    <Screen title="Family 👥" sub={`${users.length} people · ${here} in Zimbabwe`}>
      <List>
        {sorted.map((u) => (
          <div key={u.id} className="flex items-center gap-3.5 border-b border-line2 px-4 py-3.5 last:border-0">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-chip text-2xl" aria-hidden>{u.emoji}</span>
            <div>
              <div className="text-[15px] font-extrabold">
                {u.name}
                {u.is_admin && <span className="mono ml-1.5 text-[10px] text-honey">ADMIN</span>}
              </div>
              <div className="mono text-[11px] text-muted">@{u.username}</div>
            </div>
            <span className="ml-auto">
              {u.status === "here" ? <StatusPill tone="here">Here</StatusPill> : u.status === "travelling" ? <StatusPill tone="air">In the air</StatusPill> : <StatusPill tone="up">Arriving</StatusPill>}
            </span>
          </div>
        ))}
      </List>
    </Screen>
  );
}
