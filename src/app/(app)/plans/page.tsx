import Link from "next/link";
import { getRepo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/identity";
import { categoryOf } from "@/lib/display";
import { fmtDayShortUpper, fmtTime } from "@/lib/format";
import { CatPill, EmptyState, Screen } from "@/components/ui";
import { PlanJoinButton } from "@/components/interactive";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const [plans, me] = await Promise.all([getRepo().listPlans(), getCurrentUser()]);
  if (!me) return null;

  return (
    <Screen title="Plans 📋">
      {plans.length === 0 && <EmptyState emoji="📅" title="Nothing planned yet" hint="Tap + to add a plan." />}
      <div className="grid gap-3 md:grid-cols-2">
        {plans.map((p) => {
          const c = categoryOf(p.category);
          const going = p.attendees.some((a) => a.id === me.id);
          return (
            <div key={p.id} className="zc-card p-4">
              <Link href={`/plans/${p.id}`} className="block">
                <div className="flex items-start justify-between gap-2.5">
                  <div>
                    <div className="disp text-[17px] font-extrabold">{p.title}</div>
                    <div className="mono mt-0.5 text-[11px] text-muted">{fmtDayShortUpper(`${p.date}T00:00:00+02:00`)} {p.start_time ? `· ${fmtTime(`${p.date}T${p.start_time}:00+02:00`)}` : ""} {p.location ? `· ${p.location}` : ""}</div>
                  </div>
                  <CatPill icon={c.icon} label={c.label} />
                </div>
              </Link>
              <div className="mt-3 flex items-center gap-1.5">
                {p.attendees.slice(0, 6).map((a) => <span key={a.id} className="text-lg" aria-hidden>{a.emoji}</span>)}
                {p.attendees.length > 6 && <span className="mono text-[11px] text-muted">+{p.attendees.length - 6}</span>}
                {p.anyone_can_join && <PlanJoinButton planId={p.id} going={going} className="ml-auto" />}
              </div>
            </div>
          );
        })}
      </div>
    </Screen>
  );
}
