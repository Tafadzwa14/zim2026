import { getRepo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/identity";
import { tripTodayISO } from "@/lib/format";
import { EmptyState, Screen } from "@/components/ui";
import { TaskList } from "@/components/interactive";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [tasks, me] = await Promise.all([getRepo().listTasks(), getCurrentUser()]);
  if (!me) return null;

  return (
    <Screen title="Things we need ✅">
      {tasks.length === 0 ? (
        <EmptyState emoji="🎉" title="All done" hint="No tasks right now." />
      ) : (
        <TaskList tasks={tasks} meId={me.id} today={tripTodayISO()} isAdmin={me.is_admin} />
      )}
    </Screen>
  );
}
