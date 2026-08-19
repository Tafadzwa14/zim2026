import { getRepo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/identity";
import { EmptyState, List, Screen, SectionHeader } from "@/components/ui";
import { AdminUserToggle, AnnouncementPinToggle, DeleteAnnouncementButton } from "@/components/interactive";
import { SettingsForm } from "@/components/account";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const me = await getCurrentUser();
  if (!me?.is_admin) return <Screen title="Admin 🛡️"><EmptyState emoji="🔒" title="Admins only" /></Screen>;
  const repo = getRepo();
  const [users, announcements, settings] = await Promise.all([repo.listUsers(), repo.listAnnouncements(), repo.getSettings()]);

  return (
    <Screen title="Admin 🛡️">
      <SectionHeader>People</SectionHeader>
      <List>
        {users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 border-b border-line2 px-4 py-3 last:border-0">
            <span className="text-2xl" aria-hidden>{u.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-extrabold">{u.name}</div>
              <div className="mono text-[11px] text-muted">@{u.username} · {u.status}</div>
            </div>
            <AdminUserToggle userId={u.id} isAdmin={u.is_admin} />
          </div>
        ))}
      </List>

      <SectionHeader>Announcements</SectionHeader>
      {announcements.length === 0 ? (
        <EmptyState emoji="📢" title="No announcements" hint="Use + to post one." />
      ) : (
        <List>
          {announcements.map((a) => (
            <div key={a.id} className="flex items-center gap-2 border-b border-line2 px-4 py-3 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-extrabold">{a.title}</div>
                <div className="text-xs font-semibold text-muted">{a.is_pinned ? "📌 Pinned" : "Not pinned"}</div>
              </div>
              <AnnouncementPinToggle id={a.id} pinned={a.is_pinned} />
              <DeleteAnnouncementButton id={a.id} />
            </div>
          ))}
        </List>
      )}

      <SectionHeader>Settings</SectionHeader>
      <div className="zc-card p-4"><SettingsForm settings={settings} /></div>
    </Screen>
  );
}
