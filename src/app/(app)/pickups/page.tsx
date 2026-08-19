import { getRepo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/identity";
import { fmtDayShortUpper, fmtTime } from "@/lib/format";
import { CatPill, EmptyState, Screen } from "@/components/ui";
import { PickupControl } from "@/components/interactive";

export const dynamic = "force-dynamic";

export default async function PickupsPage() {
  const [travel, me, users] = await Promise.all([getRepo().listTravel(), getCurrentUser(), getRepo().listUsers()]);
  if (!me) return null;
  const runs = travel.filter((t) => t.pickup?.requested);

  return (
    <Screen title="Airport runs 🚗">
      {runs.length === 0 && <EmptyState emoji="🚗" title="No pickups needed" hint="Requests appear here when travel needs a driver." />}
      <div className="grid gap-3 md:grid-cols-2">
        {runs.map((t) => {
          const leg = t.activeLeg;
          const driver = t.pickup?.driver_user_id ? users.find((u) => u.id === t.pickup?.driver_user_id) ?? null : null;
          return (
            <div key={t.id} className="zc-card p-4">
              <div className="flex items-baseline justify-between">
                <div className="mono font-semibold">{fmtDayShortUpper(t.arrivalIso)} · {fmtTime(t.arrivalIso)}</div>
                {leg && <CatPill icon="✈️" label={leg.flight_number} />}
              </div>
              <div className="disp my-2 text-lg font-extrabold">{t.members.map((m) => m.emoji).join(" ")} {t.title}</div>
              {leg && <div className="mono text-[11px] text-muted">{leg.origin_city} → {leg.destination_city}</div>}
              <div className="mt-3"><PickupControl travelId={t.id} driver={driver} meId={me.id} isAdmin={me.is_admin} big={!driver} /></div>
            </div>
          );
        })}
      </div>
    </Screen>
  );
}
