import { getRepo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/identity";
import { FlightsBoard } from "@/components/flights-board";
import { Screen } from "@/components/ui";

export default async function FlightsPage() {
  const [travel, me, users] = await Promise.all([getRepo().listTravel(), getCurrentUser(), getRepo().listUsers()]);
  if (!me) return null;

  return (
    <Screen title="Flights ✈️" sub="Flight board and airport runs">
      <FlightsBoard travel={travel} me={me} users={users} />
    </Screen>
  );
}
