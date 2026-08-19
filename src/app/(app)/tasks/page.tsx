import { getRepo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/identity";
import { EmptyState, List, Screen } from "@/components/ui";
import { TaskItemRow } from "@/components/interactive";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const [tasks, me] = await Promise.all([getRepo().listTasks(), getCurrentUser()]);
  if (!me) return null;

  return (
    <Screen title="Things we need ✅">
      {tasks.length === 0 ? (
        <EmptyState emoji="🎉" title="All done" hint="No tasks right now." />
      ) : (
        <List>{tasks.map((t) => <TaskItemRow key={t.id} task={t} meId={me.id} />)}</List>
      )}
    </Screen>
  );
}
