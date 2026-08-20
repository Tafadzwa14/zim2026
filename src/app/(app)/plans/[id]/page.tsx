import { notFound } from "next/navigation";
import { getRepo } from "@/lib/repo";
import { getCurrentUser } from "@/lib/identity";
import { categoryOf } from "@/lib/display";
import { fmtDateLong, fmtTime } from "@/lib/format";
import { BackHeader, CatPill, PersonChip, SectionHeader } from "@/components/ui";
import { DeletePlanButton, PlanJoinWide, PlanPeopleEditor } from "@/components/interactive";
import { mapsUrl } from "@/lib/maps";

export const dynamic = "force-dynamic";

export default async function PlanDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [plan, me, users] = await Promise.all([getRepo().getPlan(id), getCurrentUser(), getRepo().listUsers()]);
  if (!plan || !me) return notFound();
  const c = categoryOf(plan.category);
  const going = plan.attendees.some((a) => a.id === me.id);
  const canEdit = plan.created_by === me.id || me.is_admin;

  return (
    <div className="mx-auto max-w-xl px-[18px] lg:max-w-3xl lg:px-8">
      <BackHeader title={plan.title} href="/plans" />
      <div className="mt-3">
        <div className="zc-card p-4">
          <CatPill icon={c.icon} label={c.label} />
          <div className="disp mt-3 text-2xl font-extrabold">{plan.title}</div>
          <div className="mono mt-1.5 text-xs text-muted">{fmtDateLong(`${plan.date}T00:00:00+02:00`)}{plan.start_time ? ` · ${fmtTime(`${plan.date}T${plan.start_time}:00+02:00`)}` : ""}</div>
          {plan.location && (
            <a href={mapsUrl(plan.location)} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-bold text-honey underline decoration-honey/40 underline-offset-2">
              📍 {plan.location}
            </a>
          )}
          {plan.description && <div className="mt-2.5 font-semibold text-ink2">{plan.description}</div>}
          <div className="mt-2.5 text-xs text-muted">Created by {plan.creator ? `${plan.creator.emoji} ${plan.creator.name}` : "—"}</div>
        </div>

        <SectionHeader meta={String(plan.attendees.length)}>Who&apos;s going</SectionHeader>
        <div className="flex flex-wrap gap-2">{plan.attendees.map((a) => <PersonChip key={a.id} user={a} />)}</div>

        {plan.anyone_can_join && <div className="mt-4"><PlanJoinWide planId={plan.id} going={going} /></div>}

        {canEdit && (
          <>
            <SectionHeader>Add or remove people</SectionHeader>
            <PlanPeopleEditor planId={plan.id} attendeeIds={plan.attendees.map((a) => a.id)} users={users} />
            <div className="mt-4"><DeletePlanButton planId={plan.id} /></div>
          </>
        )}
      </div>
    </div>
  );
}
