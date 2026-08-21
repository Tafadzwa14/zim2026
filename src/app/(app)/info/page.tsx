import { getRepo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/identity";
import { FamilyTable } from "@/components/family-table";
import { List, Screen, SectionHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const ICON: Record<string, string> = { Emergency: "🚨", "Home / Base": "🏠", Wedding: "💍", Transport: "🚗", "Useful Places": "📍" };

export default async function InfoPage() {
  const me = await getCurrentUser();
  const [users, groups] = await Promise.all([getRepo().listUsers(), getRepo().listInfo()]);
  // Phone numbers are admin-only, so non-admins never trigger that read.
  const phones = me?.is_admin ? await getRepo().listPhoneNumbers() : null;
  const here = users.filter((u) => u.status === "here").length;

  return (
    <Screen title="Info ℹ️" sub={`${users.length} people, ${here} here`}>
      <FamilyTable users={users} phones={phones} />
      <SectionHeader>Important info</SectionHeader>
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
      {me?.is_admin && <p className="mt-4 text-xs text-muted">You&apos;re an admin, so you can edit important info and phone numbers from the Admin area.</p>}
    </Screen>
  );
}
