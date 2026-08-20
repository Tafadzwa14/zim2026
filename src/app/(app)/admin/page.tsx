import { getRepo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/identity";
import { EmptyState, List, Screen, SectionHeader } from "@/components/ui";
import { AnnouncementPinToggle, DeleteAnnouncementButton } from "@/components/interactive";
import { AddPersonForm, AdminTabs, BulkLocation, InfoManager, NudgeUnclaimed, PlacesManager, RosterRow } from "@/components/admin";
import { SettingsForm } from "@/components/account";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const me = await getCurrentUser();
  if (!me?.is_admin) return <Screen title="Admin 🛡️"><EmptyState emoji="🔒" title="Admins only" /></Screen>;
  const repo = getRepo();
  const [roster, places, info, announcements, settings] = await Promise.all([
    repo.listRoster(),
    repo.listPlaces(),
    repo.listInfo(),
    repo.listAnnouncements(),
    repo.getSettings(),
  ]);
  const claimed = roster.filter((u) => u.claimed).length;

  return (
    <Screen title="Admin 🛡️">
      <AdminTabs
        tabs={[
          {
            key: "people",
            label: "People",
            content: (
              <>
                <SectionHeader meta={`${claimed}/${roster.length} claimed`}>People</SectionHeader>
                <div className="mb-3"><AddPersonForm /></div>
                <List>
                  {roster.map((u) => <RosterRow key={u.id} u={u} meId={me.id} places={places} />)}
                </List>
              </>
            ),
          },
          {
            key: "unclaimed",
            label: "Unclaimed",
            content: (
              <>
                <SectionHeader meta={`${roster.length - claimed} pending`}>Not yet claimed</SectionHeader>
                <NudgeUnclaimed roster={roster} />
              </>
            ),
          },
          {
            key: "locations",
            label: "Locations",
            content: (
              <>
                <SectionHeader>Set locations in bulk</SectionHeader>
                <BulkLocation roster={roster} places={places} />
              </>
            ),
          },
          {
            key: "places",
            label: "Places",
            content: (
              <>
                <SectionHeader>Places</SectionHeader>
                <PlacesManager places={places} />
              </>
            ),
          },
          {
            key: "info",
            label: "Info",
            content: (
              <>
                <SectionHeader>Important info</SectionHeader>
                <InfoManager groups={info} />
              </>
            ),
          },
          {
            key: "announcements",
            label: "Announcements",
            content: (
              <>
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
              </>
            ),
          },
          {
            key: "settings",
            label: "Settings",
            content: (
              <>
                <SectionHeader>Settings</SectionHeader>
                <div className="zc-card p-4"><SettingsForm settings={settings} /></div>
              </>
            ),
          },
        ]}
      />
    </Screen>
  );
}
