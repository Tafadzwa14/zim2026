import { getRepo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/identity";
import { EmptyState, Screen } from "@/components/ui";
import { ActivityFeed } from "@/components/interactive";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const [activity, me] = await Promise.all([getRepo().listActivity(50), getCurrentUser()]);
  if (!me) return null;
  if (!activity.length) return <Screen title="Activity 🔔"><EmptyState emoji="🔔" title="Nothing yet" /></Screen>;

  return (
    <Screen title="Activity 🔔">
      <ActivityFeed activity={activity} meId={me.id} />
    </Screen>
  );
}
