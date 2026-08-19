"use client";

import { cn } from "@/lib/cn";
import { useAction } from "@/lib/use-action";
import * as actions from "@/lib/actions";
import { fmtDayShort } from "@/lib/format";
import type { ShoppingView, TaskView } from "@/lib/repo/types";
import type { ActionResult } from "@/lib/actions";
import type { PublicUser } from "@/lib/types";

function Btn({
  onClick,
  children,
  className,
  variant = "outline",
  disabled,
}: {
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
  variant?: "outline" | "solid" | "ghost" | "danger";
  disabled?: boolean;
}) {
  const base =
    variant === "solid"
      ? "zc-btn"
      : variant === "danger"
        ? "zc-btn zc-btn-danger"
        : variant === "ghost"
          ? "zc-btn zc-btn-ghost"
          : "border border-honey text-honey";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(base, variant === "outline" && "whitespace-nowrap rounded-[10px] bg-transparent px-3 py-1.5 text-xs font-extrabold", className)}
    >
      {children}
    </button>
  );
}

export function ShoppingItemRow({ item, meId }: { item: ShoppingView; meId: string }) {
  const { run } = useAction();
  const mine = item.claimed_by === meId;
  return (
    <div className={cn("flex items-center gap-3 border-b border-line2 px-4 py-3.5 last:border-0", item.completed && "opacity-70")}>
      <button
        aria-label={item.completed ? "Mark not done" : "Mark done"}
        onClick={() => run(() => actions.toggleShopping(item.id, !item.completed))}
        className={cn("grid h-6 w-6 flex-none place-items-center rounded-lg border-2 text-sm text-white", item.completed ? "border-good bg-good" : "border-[#d9cdb8] bg-card")}
      >
        {item.completed ? "✓" : ""}
      </button>
      <div className="min-w-0 flex-1">
        <div className={cn("text-[15px] font-extrabold", item.completed && "line-through text-muted")}>{item.item}</div>
        {item.claimer && !item.completed && <div className="text-xs font-semibold text-muted">Getting this: {item.claimer.emoji} {item.claimer.name}</div>}
        {item.completed && item.claimer && <div className="text-xs font-semibold text-muted">Done · {item.claimer.emoji} {item.claimer.name}</div>}
      </div>
      <span className="mono rounded-md bg-chip px-2 py-0.5 text-xs font-semibold text-ink2">×{item.quantity}</span>
      {!item.completed &&
        (item.claimer ? (
          mine ? (
            <Btn onClick={() => run(() => actions.unclaimShopping(item.id))}>Unclaim</Btn>
          ) : (
            <span className="text-lg" aria-label={`Claimed by ${item.claimer.name}`}>{item.claimer.emoji}</span>
          )
        ) : (
          <Btn onClick={() => run(() => actions.claimShopping(item.id))}>I&apos;ll get it</Btn>
        ))}
    </div>
  );
}

export function TaskItemRow({ task, meId }: { task: TaskView; meId: string }) {
  const { run } = useAction();
  const mine = task.assigned_to === meId;
  return (
    <div className={cn("flex items-center gap-3 border-b border-line2 px-4 py-3.5 last:border-0", task.completed && "opacity-70")}>
      <button
        aria-label={task.completed ? "Mark not done" : "Mark done"}
        onClick={() => run(() => actions.toggleTask(task.id, !task.completed))}
        className={cn("grid h-6 w-6 flex-none place-items-center rounded-lg border-2 text-sm text-white", task.completed ? "border-good bg-good" : "border-[#d9cdb8] bg-card")}
      >
        {task.completed ? "✓" : ""}
      </button>
      <div className="min-w-0 flex-1">
        <div className={cn("text-[15px] font-extrabold", task.completed && "line-through text-muted")}>{task.title}</div>
        {task.assignee ? (
          <div className="text-xs font-semibold text-muted">{task.completed ? "Done" : "On it"}: {task.assignee.emoji} {task.assignee.name}</div>
        ) : task.due_date ? (
          <div className="text-xs font-semibold text-muted">Due {fmtDayShort(`${task.due_date}T00:00:00+02:00`)}</div>
        ) : null}
      </div>
      {!task.completed &&
        (task.assignee ? (
          mine ? (
            <Btn onClick={() => run(() => actions.unclaimTask(task.id))}>Drop</Btn>
          ) : (
            <span className="text-lg" aria-label={`On ${task.assignee.name}`}>{task.assignee.emoji}</span>
          )
        ) : (
          <Btn onClick={() => run(() => actions.claimTask(task.id))}>I&apos;ll do it</Btn>
        ))}
    </div>
  );
}

export function PickupControl({ travelId, driver, meId, isAdmin, big }: { travelId: string; driver: PublicUser | null; meId: string; isAdmin: boolean; big?: boolean }) {
  const { run } = useAction();
  if (driver) {
    const canRelease = driver.id === meId || isAdmin;
    return (
      <div className="flex items-center gap-2">
        <b className="text-[15px]">Pickup: {driver.emoji} {driver.name} ✓</b>
        {canRelease && <Btn className="ml-auto" onClick={() => run(() => actions.releasePickup(travelId))}>{driver.id === meId ? "Release" : "Reassign"}</Btn>}
      </div>
    );
  }
  return big ? (
    <Btn variant="solid" className="w-full" onClick={() => run(() => actions.claimPickup(travelId))}>I&apos;ll pick them up</Btn>
  ) : (
    <Btn onClick={() => run(() => actions.claimPickup(travelId))}>I&apos;ll go</Btn>
  );
}

export function PlanJoinButton({ planId, going, className }: { planId: string; going: boolean; className?: string }) {
  const { run } = useAction();
  return going ? (
    <button onClick={() => run(() => actions.leavePlan(planId))} className={cn("whitespace-nowrap rounded-[10px] border border-good px-3 py-1.5 text-xs font-extrabold text-good", className)}>
      Leave
    </button>
  ) : (
    <button onClick={() => run(() => actions.joinPlan(planId))} className={cn("whitespace-nowrap rounded-[10px] border border-honey px-3 py-1.5 text-xs font-extrabold text-honey", className)}>
      + I&apos;m coming
    </button>
  );
}

export function PlanJoinWide({ planId, going }: { planId: string; going: boolean }) {
  const { run } = useAction();
  return going ? (
    <Btn variant="ghost" className="w-full" onClick={() => run(() => actions.leavePlan(planId))}>Leave this plan</Btn>
  ) : (
    <Btn variant="solid" className="w-full" onClick={() => run(() => actions.joinPlan(planId))}>+ I&apos;m coming</Btn>
  );
}

export function DeletePlanButton({ planId }: { planId: string }) {
  const { run } = useAction();
  return (
    <Btn variant="danger" className="w-full py-3 text-sm" onClick={() => { if (confirm("Delete this plan?")) run(() => actions.deletePlan(planId)); }}>
      Delete plan
    </Btn>
  );
}

export function PlanPeopleEditor({ planId, attendeeIds, users }: { planId: string; attendeeIds: string[]; users: PublicUser[] }) {
  const { run } = useAction();
  return (
    <div className="flex flex-wrap gap-2">
      {users.map((u) => {
        const on = attendeeIds.includes(u.id);
        return (
          <button
            key={u.id}
            onClick={() => run(() => (on ? actions.removeAttendee(planId, u.id) : actions.addAttendee(planId, u.id)))}
            className={cn("flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-[13px] font-extrabold", on ? "border-honey bg-[#fbecd8] text-[#8a5115] dark:bg-[color-mix(in_srgb,var(--honey)_22%,transparent)] dark:text-ink" : "border-line bg-card")}
          >
            <span className="text-base" aria-hidden>{u.emoji}</span>
            {u.name}
          </button>
        );
      })}
    </div>
  );
}

export function AdminUserToggle({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const { run } = useAction();
  return <Btn onClick={() => run(() => actions.setAdmin(userId, !isAdmin))}>{isAdmin ? "Revoke admin" : "Make admin"}</Btn>;
}

export function AnnouncementPinToggle({ id, pinned }: { id: string; pinned: boolean }) {
  const { run } = useAction();
  return <Btn onClick={() => run(() => actions.setAnnouncementPinned(id, !pinned))}>{pinned ? "Unpin" : "Pin"}</Btn>;
}

export function DeleteAnnouncementButton({ id }: { id: string }) {
  const { run } = useAction();
  return <Btn onClick={() => run(() => actions.deleteAnnouncement(id))}>Remove</Btn>;
}

export function FlightStatusAdmin({ travelId, legId }: { travelId: string; legId: string }) {
  const { run } = useAction();
  return <Btn variant="ghost" className="w-full py-2.5 text-sm" onClick={() => run(() => actions.cycleFlightStatus(travelId, legId))}>Admin: advance flight status</Btn>;
}

export function SwitchUserButton({ userId, current, emoji, name }: { userId: string; current: boolean; emoji: string; name: string }) {
  const { run } = useAction();
  return (
    <button
      onClick={() => !current && run<ActionResult>(() => actions.switchUser(userId))}
      className={cn("zc-chip", current && "border-honey bg-[#fbecd8] dark:bg-[color-mix(in_srgb,var(--honey)_20%,transparent)]")}
    >
      <span className="text-lg" aria-hidden>{emoji}</span>
      {name}
    </button>
  );
}
