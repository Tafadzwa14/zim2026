import { StatusPill } from "@/components/ui";
import { ROLES } from "@/lib/types";
import type { PublicUser } from "@/lib/types";

const ORDER = { here: 0, travelling: 1, upcoming: 2 } as const;
const TH = "whitespace-nowrap px-3 py-2.5 text-left font-bold";
const TD = "px-3 py-3 align-middle";

function Dash() {
  return <span className="text-muted">–</span>;
}

/**
 * The family directory: everyone on the trip, sorted here → travelling →
 * upcoming then by name. `phones` is non-null for admins only; everyone else
 * gets a dash in the Call column.
 */
export function FamilyTable({ users, phones }: { users: PublicUser[]; phones: Record<string, string | null> | null }) {
  const sorted = [...users].sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name));

  return (
    <div className="zc-card overflow-hidden p-0">
      {/* Focusable and named so a keyboard can scroll across to Status and Call
          on a narrow phone (WCAG 2.1.1). */}
      <div
        role="region"
        aria-label="Family directory"
        tabIndex={0}
        className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-honey"
      >
        <table className="w-full min-w-[580px] border-collapse text-sm">
          <thead>
            <tr className="mono border-b border-line text-[10px] uppercase tracking-[0.08em] text-muted">
              <th scope="col" className={TH}>Person</th>
              <th scope="col" className={TH}>Roles</th>
              <th scope="col" className={TH}>Staying at</th>
              <th scope="col" className={TH}>Status</th>
              <th scope="col" className={TH}>Call</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((u) => {
              const roleLabels = ROLES.filter((r) => u.roles.includes(r.slug));
              const phone = phones?.[u.id] ?? null;
              return (
                <tr key={u.id} className="border-b border-line2 last:border-0">
                  <td className={TD}>
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-chip text-xl" aria-hidden>{u.emoji}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 whitespace-nowrap text-[15px] font-extrabold">
                          {u.name}
                          {u.is_admin && <span className="mono text-[10px] text-honey">ADMIN</span>}
                        </div>
                        <div className="mono text-[11px] text-muted">@{u.username}</div>
                      </div>
                    </div>
                  </td>
                  <td className={TD}>
                    {roleLabels.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {roleLabels.map((r) => (
                          <span key={r.slug} className="whitespace-nowrap rounded-full bg-chip px-2 py-0.5 text-[10px] font-bold text-ink2"><span aria-hidden>{r.emoji}</span> {r.label}</span>
                        ))}
                      </div>
                    ) : <Dash />}
                  </td>
                  <td className={TD}>
                    {u.staying_at ? <span className="whitespace-nowrap text-[13px] font-semibold text-ink2"><span aria-hidden>📍</span> {u.staying_at}</span> : <Dash />}
                  </td>
                  <td className={TD}>
                    {u.status === "travelling" ? (
                      <StatusPill tone="air">In the air</StatusPill>
                    ) : u.status === "upcoming" ? (
                      <StatusPill tone="up">Arriving</StatusPill>
                    ) : <Dash />}
                  </td>
                  <td className={TD}>
                    {phones && phone ? (
                      <div className="flex items-center gap-2">
                        <span className="mono whitespace-nowrap text-xs text-ink2">{phone}</span>
                        <button
                          type="button"
                          disabled
                          aria-label={`Call ${u.name} (coming soon)`}
                          title="Calling from the app is coming soon"
                          className="whitespace-nowrap rounded-[10px] border border-line px-2.5 py-1 text-xs font-extrabold text-muted opacity-60"
                        >
                          Call
                        </button>
                      </div>
                    ) : <Dash />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
