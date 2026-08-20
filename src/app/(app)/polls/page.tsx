import { getRepo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/identity";
import { Screen } from "@/components/ui";
import { PollsClient } from "@/components/polls";

export const dynamic = "force-dynamic";

export default async function PollsPage() {
  const me = await getCurrentUser();
  if (!me) return null;
  const polls = await getRepo().listPolls(me.id);

  return (
    <Screen title="Polls 📊" sub="Settle it with a quick vote">
      <PollsClient polls={polls} meId={me.id} isAdmin={me.is_admin} />
    </Screen>
  );
}
