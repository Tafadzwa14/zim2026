import { isSupabaseConfigured } from "@/lib/env";
import { getRepo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/identity";
import { Screen, SectionHeader } from "@/components/ui";
import { ThemeToggle } from "@/components/providers";
import { SignOutButton } from "@/components/account";
import { SwitchUserButton } from "@/components/interactive";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const me = await getCurrentUser();
  if (!me) return null;
  const repo = getRepo();
  const [users, settings] = await Promise.all([repo.listUsers(), repo.getSettings()]);
  const isMemory = !isSupabaseConfigured();

  return (
    <Screen title="Profile" action={<ThemeToggle className="flex h-10 w-10 items-center justify-center rounded-[13px] border border-line bg-card text-lg" />}>
      <div className="zc-card p-6 text-center">
        <div className="text-6xl" aria-hidden>{me.emoji}</div>
        <div className="disp mt-2 text-2xl font-extrabold">{me.name}</div>
        <div className="mono text-muted">@{me.username}{me.is_admin ? " · ADMIN" : ""}</div>
      </div>

      {isMemory && (
        <>
          <SectionHeader>You&apos;re viewing as</SectionHeader>
          <div className="mt-3 flex flex-wrap gap-2">
            {users.map((u) => <SwitchUserButton key={u.id} userId={u.id} current={u.id === me.id} emoji={u.emoji} name={u.name} />)}
          </div>
        </>
      )}

      <div className="mt-6 flex flex-col gap-2.5">
        <a href={settings.wedding_url || "#"} target="_blank" rel="noreferrer" className="zc-btn zc-btn-ghost w-full">💍 Open wedding site</a>
        <SignOutButton />
      </div>
      <p className="mt-5 text-center text-xs text-muted">No push notifications in v1 · private family hub · noindex</p>
    </Screen>
  );
}
