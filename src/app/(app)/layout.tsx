import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/identity";
import { getRepo } from "@/lib/repo";
import { ThemeProvider, ToastProvider } from "@/components/providers";
import { AppFrame } from "@/components/app-frame";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/onboarding");

  const repo = getRepo();
  const [users, settings, shopping, tasks, travel, places] = await Promise.all([
    repo.listUsers(),
    repo.getSettings(),
    repo.listShopping(),
    repo.listTasks(),
    repo.listTravel(),
    repo.listPlaces(),
  ]);
  const counts = {
    pickups: travel.filter((t) => t.pickup?.requested && !t.pickup.driver_user_id).length,
    shopping: shopping.filter((s) => !s.completed).length,
    tasks: tasks.filter((t) => !t.completed).length,
  };

  return (
    <ThemeProvider>
      <ToastProvider>
        <AppFrame
          user={user}
          users={users}
          places={places}
          appTitle={settings.app_title}
          isMemory={!isSupabaseConfigured()}
          counts={counts}
        >
          {children}
        </AppFrame>
      </ToastProvider>
    </ThemeProvider>
  );
}
