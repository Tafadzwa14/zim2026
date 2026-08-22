"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { EmptyState, List } from "@/components/ui";
import { Sheet } from "@/components/sheet";
import { ShoppingForm, TaskForm } from "@/components/forms";
import { useAction } from "@/lib/use-action";
import * as actions from "@/lib/actions";
import { fmtDayShort, timeAgo, tripInstant } from "@/lib/format";
import type { ActivityView, ShoppingView, TaskView } from "@/lib/repo/types";
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

export function ShoppingItemRow({ item, meId, users = [] }: { item: ShoppingView; meId: string; users?: PublicUser[] }) {
  const { run, pending } = useAction();
  const mine = item.claimed_by === meId;
  // Optimistic tick: reflect the toggle instantly, then reconcile to the
  // server value once the action settles.
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [picking, setPicking] = useState(false);
  const completed = optimistic ?? item.completed;
  useEffect(() => {
    // Reconcile the optimistic tick to the server value once the action settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!pending) setOptimistic(null);
  }, [pending, item.completed]);
  const toggle = () => {
    const next = !completed;
    setOptimistic(next);
    run(() => actions.toggleShopping(item.id, next));
  };
  const assign = (userId: string | null) => {
    setPicking(false);
    run(() => actions.assignShopping(item.id, userId));
  };
  return (
    <div className={cn("border-b border-line2 last:border-0", completed && "opacity-70")}>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button
          aria-label={completed ? "Mark not done" : "Mark done"}
          onClick={toggle}
          className={cn("grid h-6 w-6 flex-none place-items-center rounded-lg border-2 text-sm text-white", completed ? "border-good bg-good" : "border-[#d9cdb8] bg-card")}
        >
          {completed ? "✓" : ""}
        </button>
        <div className="min-w-0 flex-1">
          <div className={cn("text-[15px] font-extrabold", completed && "line-through text-muted")}>{item.item}</div>
          {item.claimer && !completed && <div className="text-xs font-semibold text-muted">Getting this: {item.claimer.emoji} {item.claimer.name}</div>}
          {completed && item.claimer && <div className="text-xs font-semibold text-muted">Done · {item.claimer.emoji} {item.claimer.name}</div>}
        </div>
        <span className="mono rounded-md bg-chip px-2 py-0.5 text-xs font-semibold text-ink2">×{item.quantity}</span>
        {!completed &&
          (item.claimer ? (
            mine ? (
              <Btn onClick={() => run(() => actions.unclaimShopping(item.id))}>Unclaim</Btn>
            ) : (
              <span className="text-lg" aria-label={`Claimed by ${item.claimer.name}`}>{item.claimer.emoji}</span>
            )
          ) : (
            <Btn onClick={() => run(() => actions.claimShopping(item.id))}>I&apos;ll get it</Btn>
          ))}
        {!completed && users.length > 0 && (
          <button
            aria-label="Tag someone"
            aria-expanded={picking}
            onClick={() => setPicking((p) => !p)}
            className={cn("grid h-8 w-8 flex-none place-items-center rounded-lg border text-sm", picking ? "border-honey text-honey" : "border-line text-muted")}
          >
            👤
          </button>
        )}
      </div>
      {picking && !completed && (
        <div className="flex flex-wrap gap-2 px-4 pb-3.5">
          {[{ id: null as string | null, emoji: "🤷", name: "Anyone" }, ...users].map((u) => {
            const on = item.claimed_by === u.id;
            const label = u.id === meId ? "Me" : u.name;
            return (
              <button
                key={u.id ?? "none"}
                onClick={() => assign(u.id)}
                className={cn("flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-[13px] font-extrabold", on ? "border-honey bg-[color-mix(in_srgb,var(--honey)_15%,transparent)] text-honey" : "border-line bg-card")}
              >
                <span className="text-base" aria-hidden>{u.emoji}</span>
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const SHOP_CATS = ["Groceries", "Wedding", "House", "Other"];
// Open items float up (unclaimed before claimed); done items sink.
function shopRank(s: ShoppingView) {
  if (s.completed) return 2;
  return s.claimed_by ? 1 : 0;
}
type ShopSeg = "all" | "mine" | "todo";

/** Header action for the Shopping tab — opens the shopping form in a sheet. */
export function AddShoppingButton({ me, users }: { me: PublicUser; users: PublicUser[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="zc-btn whitespace-nowrap px-3.5 py-2 text-sm">
        ＋ Add item
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Add shopping item">
        <ShoppingForm me={me} users={users} onDone={() => setOpen(false)} />
      </Sheet>
    </>
  );
}

export function ShoppingList({ items, meId, users }: { items: ShoppingView[]; meId: string; users: PublicUser[] }) {
  const [seg, setSeg] = useState<ShopSeg>("all");

  const counts = useMemo(() => {
    let all = 0, mine = 0, todo = 0;
    for (const s of items) {
      if (s.completed) continue;
      all++;
      if (s.claimed_by === meId) mine++;
      if (!s.claimed_by) todo++;
    }
    return { all, mine, todo };
  }, [items, meId]);

  const visible = useMemo(
    () =>
      items.filter((s) => {
        if (seg === "mine") return s.claimed_by === meId;
        if (seg === "todo") return !s.claimed_by && !s.completed;
        return true;
      }),
    [items, seg, meId],
  );

  // Single-pass grouping: keep known categories in order, append any others.
  const groups = useMemo(() => {
    const m = new Map<string, ShoppingView[]>();
    for (const cat of SHOP_CATS) m.set(cat, []);
    for (const it of visible) {
      const g = m.get(it.category);
      if (g) g.push(it);
      else m.set(it.category, [it]);
    }
    return [...m].filter(([, g]) => g.length);
  }, [visible]);

  const segs: { key: ShopSeg; label: string; n: number }[] = [
    { key: "all", label: "All", n: counts.all },
    { key: "mine", label: "Mine", n: counts.mine },
    { key: "todo", label: "To do", n: counts.todo },
  ];

  return (
    <div>
      <div role="tablist" aria-label="Filter shopping list" className="mb-4 flex gap-1 rounded-xl border border-line bg-card p-1">
        {segs.map((s) => (
          <button
            key={s.key}
            role="tab"
            aria-selected={seg === s.key}
            onClick={() => setSeg(s.key)}
            className={cn(
              "flex-1 rounded-lg px-3 py-1.5 text-[13px] font-extrabold transition-colors",
              seg === s.key ? "bg-honey text-white" : "text-muted",
            )}
          >
            {s.label}
            <span className={cn("mono ml-1.5 text-[11px]", seg === s.key ? "text-white/80" : "text-muted")}>{s.n}</span>
          </button>
        ))}
      </div>
      {groups.length === 0 ? (
        <EmptyState
          emoji={seg === "mine" ? "🙌" : "🎉"}
          title={seg === "mine" ? "Nothing on you" : "Nothing to grab"}
          hint={seg === "all" ? "The list is empty." : "Switch to All to see everything."}
        />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(([cat, group]) => {
            const left = group.filter((s) => !s.completed).length;
            const sorted = [...group].sort((a, b) => shopRank(a) - shopRank(b));
            return (
              <div key={cat}>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="disp text-[15px] font-extrabold">{cat}</span>
                  <span className="mono text-[11px] uppercase tracking-wide text-muted">{left ? `${left} left` : "all done"}</span>
                </div>
                <List>{sorted.map((it) => <ShoppingItemRow key={it.id} item={it} meId={meId} users={users} />)}</List>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function TaskItemRow({ task, meId, today, isAdmin = false }: { task: TaskView; meId: string; today?: string; isAdmin?: boolean }) {
  const { run } = useAction();
  const [editing, setEditing] = useState(false);
  const mine = task.assigned_to === meId;
  const canManage = task.created_by === meId || isAdmin;
  const overdue = !task.completed && !!task.due_date && !!today && task.due_date < today;
  return (
    <div className={cn("flex items-center gap-3 border-b border-line2 px-4 py-3.5 last:border-0", task.completed && "opacity-70", overdue && "bg-[color-mix(in_srgb,var(--warn)_8%,transparent)]")}>
      <button
        aria-label={task.completed ? "Mark not done" : "Mark done"}
        onClick={() => run(() => actions.toggleTask(task.id, !task.completed))}
        className={cn("grid h-6 w-6 flex-none place-items-center rounded-lg border-2 text-sm text-white", task.completed ? "border-good bg-good" : overdue ? "border-warn bg-card" : "border-[#d9cdb8] bg-card")}
      >
        {task.completed ? "✓" : ""}
      </button>
      <div className="min-w-0 flex-1">
        <div className={cn("flex items-center gap-1.5 text-[15px] font-extrabold", task.completed && "line-through text-muted")}>
          {task.title}
          {overdue && <span className="mono rounded bg-[color-mix(in_srgb,var(--warn)_18%,transparent)] px-1.5 py-0.5 text-[9px] font-bold uppercase text-warn">Overdue</span>}
        </div>
        {task.due_date && (
          <div className={cn("text-xs font-semibold", overdue ? "text-warn" : "text-muted")}>
            {overdue ? "Was due " : "Due "}{fmtDayShort(tripInstant(task.due_date))}
          </div>
        )}
        {task.assignee && (
          <div className="text-xs font-semibold text-muted">{task.completed ? "Done" : "On it"}: {task.assignee.emoji} {task.assignee.name}</div>
        )}
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
      {canManage && (
        <button
          aria-label="Edit task"
          onClick={() => setEditing(true)}
          className="grid h-8 w-8 flex-none place-items-center rounded-lg border border-line text-sm text-muted"
        >
          ✏️
        </button>
      )}
      {canManage && (
        <Sheet open={editing} onClose={() => setEditing(false)} title="Edit task">
          <TaskForm task={task} onDone={() => setEditing(false)} />
          <Btn
            variant="danger"
            className="mt-3 w-full py-3 text-sm"
            onClick={() => { if (confirm("Delete this task?")) run(() => actions.deleteTask(task.id), { onSuccess: () => setEditing(false) }); }}
          >
            Delete task
          </Btn>
        </Sheet>
      )}
    </div>
  );
}

type TaskSeg = "all" | "mine" | "todo";

/** Tasks page list with All / Mine / To-do filters and overdue-first ordering. */
export function TaskList({ tasks, meId, today, isAdmin = false }: { tasks: TaskView[]; meId: string; today: string; isAdmin?: boolean }) {
  const [seg, setSeg] = useState<TaskSeg>("all");

  const counts = useMemo(() => {
    let all = 0, mine = 0, todo = 0;
    for (const t of tasks) {
      if (t.completed) continue;
      all++;
      if (t.assigned_to === meId) mine++;
      if (!t.assigned_to) todo++;
    }
    return { all, mine, todo };
  }, [tasks, meId]);

  const visible = useMemo(() => {
    const filtered = tasks.filter((t) => {
      if (seg === "mine") return t.assigned_to === meId;
      if (seg === "todo") return !t.assigned_to && !t.completed;
      return true;
    });
    const rank = (t: TaskView) => {
      if (t.completed) return 3;
      if (t.due_date && t.due_date < today) return 0; // overdue first
      if (t.due_date) return 1;
      return 2;
    };
    return [...filtered].sort((a, b) => rank(a) - rank(b) || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  }, [tasks, seg, meId, today]);

  const segs: { key: TaskSeg; label: string; n: number }[] = [
    { key: "all", label: "All", n: counts.all },
    { key: "mine", label: "Mine", n: counts.mine },
    { key: "todo", label: "Unclaimed", n: counts.todo },
  ];

  return (
    <div>
      <div role="tablist" aria-label="Filter tasks" className="mb-4 flex gap-1 rounded-xl border border-line bg-card p-1">
        {segs.map((s) => (
          <button
            key={s.key}
            role="tab"
            aria-selected={seg === s.key}
            onClick={() => setSeg(s.key)}
            className={cn("flex-1 rounded-lg px-3 py-1.5 text-[13px] font-extrabold transition-colors", seg === s.key ? "bg-honey text-white" : "text-muted")}
          >
            {s.label}
            <span className={cn("mono ml-1.5 text-[11px]", seg === s.key ? "text-white/80" : "text-muted")}>{s.n}</span>
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <EmptyState emoji={seg === "mine" ? "🙌" : "🎉"} title={seg === "mine" ? "Nothing on you" : "Nothing here"} hint={seg === "all" ? "No tasks right now." : "Switch to All to see everything."} />
      ) : (
        <List>{visible.map((t) => <TaskItemRow key={t.id} task={t} meId={meId} today={today} isAdmin={isAdmin} />)}</List>
      )}
    </div>
  );
}

export function ActivityFeed({ activity, meId }: { activity: ActivityView[]; meId: string }) {
  const [mineOnly, setMineOnly] = useState(false);
  const visible = useMemo(() => (mineOnly ? activity.filter((a) => a.actor_user_id === meId) : activity), [activity, mineOnly, meId]);

  return (
    <div>
      <div role="tablist" aria-label="Filter activity" className="mb-4 flex gap-1 rounded-xl border border-line bg-card p-1">
        {[{ k: false, label: "Everyone" }, { k: true, label: "By me" }].map((t) => (
          <button
            key={String(t.k)}
            role="tab"
            aria-selected={mineOnly === t.k}
            onClick={() => setMineOnly(t.k)}
            className={cn("flex-1 rounded-lg px-3 py-1.5 text-[13px] font-extrabold transition-colors", mineOnly === t.k ? "bg-honey text-white" : "text-muted")}
          >
            {t.label}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <EmptyState emoji="🔕" title="Nothing from you yet" hint="Switch to Everyone to see all activity." />
      ) : (
        <div className="zc-card px-4 py-1">
          {visible.map((a) => (
            <div key={a.id} className="flex gap-3 border-b border-line2 py-3.5 last:border-0">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-chip text-xl" aria-hidden>{a.actor?.emoji ?? "👤"}</span>
              <div>
                <div className="text-sm font-semibold leading-snug"><b>{a.actor?.name ?? "Someone"}</b> {(a.metadata as { text?: string })?.text}</div>
                <div className="mono mt-0.5 text-[10.5px] text-muted">{timeAgo(a.created_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PickupControl({ pickupId, driver, meId, isAdmin, canDrive, drivers = [], big, enRoute }: { pickupId: string; driver: PublicUser | null; meId: string; isAdmin: boolean; canDrive: boolean; drivers?: PublicUser[]; big?: boolean; enRoute?: boolean }) {
  const { run } = useAction();
  const [assigning, setAssigning] = useState(false);
  // Admins can hand the run to any eligible driver (other than the current one).
  const assignable = isAdmin ? drivers.filter((u) => u.id !== driver?.id) : [];
  const assign = (userId: string) => {
    setAssigning(false);
    run(() => actions.assignPickup(pickupId, userId));
  };
  const assignPicker = assignable.length > 0 && (
    <div className="flex w-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <Btn variant="ghost" onClick={() => setAssigning((a) => !a)}>{assigning ? "Cancel" : driver ? "Assign someone else" : "Assign a driver"}</Btn>
      </div>
      {assigning && (
        <div className="flex flex-wrap gap-2">
          {assignable.map((u) => (
            <button
              key={u.id}
              onClick={() => assign(u.id)}
              className="flex items-center gap-1.5 rounded-full border-[1.5px] border-line bg-card px-3 py-1.5 text-[13px] font-extrabold"
            >
              <span className="text-base" aria-hidden>{u.emoji}</span>
              {u.id === meId ? "Me" : u.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (driver) {
    const canRelease = driver.id === meId || isAdmin;
    const canGo = driver.id === meId || isAdmin;
    return (
      <div className="flex w-full flex-wrap items-center gap-2">
        <b className="text-[15px]">Pickup: {driver.emoji} {driver.name} ✓</b>
        {enRoute && <span className="rounded-full bg-[color-mix(in_srgb,var(--good)_18%,transparent)] px-2 py-0.5 text-[11px] font-bold text-good">🚗 On the way</span>}
        <div className="ml-auto flex items-center gap-2">
          {canGo && (
            <Btn variant={enRoute ? "outline" : "solid"} onClick={() => run(() => actions.setPickupEnRoute(pickupId, !enRoute))}>
              {enRoute ? "Not yet" : "I'm on my way"}
            </Btn>
          )}
          {canRelease && <Btn onClick={() => run(() => actions.releasePickup(pickupId))}>{driver.id === meId ? "Release" : "Reopen"}</Btn>}
        </div>
        {assignPicker}
      </div>
    );
  }
  if (!canDrive && !isAdmin) {
    return <p className="text-[13px] text-muted">Needs a driver — ask an admin if you can help.</p>;
  }
  return (
    <div className="flex w-full flex-col gap-2">
      {canDrive &&
        (big ? (
          <Btn variant="solid" className="w-full" onClick={() => run(() => actions.claimPickup(pickupId))}>I&apos;ll pick them up</Btn>
        ) : (
          <Btn onClick={() => run(() => actions.claimPickup(pickupId))}>I&apos;ll go</Btn>
        ))}
      {assignPicker}
    </div>
  );
}

export function PickupRequirementAdmin({ travelId, legId, required }: { travelId: string; legId: string; required: boolean }) {
  const { run, pending } = useAction();
  return (
    <Btn
      variant={required ? "danger" : "outline"}
      disabled={pending}
      onClick={() => run(() => actions.setPickupRequired(travelId, legId, !required))}
    >
      {pending ? "Saving…" : required ? "Disable airport pickup" : "Enable airport pickup"}
    </Btn>
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
            className={cn("flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-[13px] font-extrabold", on ? "border-honey bg-[color-mix(in_srgb,var(--honey)_15%,transparent)] text-honey" : "border-line bg-card")}
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

export function RefreshFlight({ travelId }: { travelId: string }) {
  const { run, pending } = useAction();
  return (
    <button
      onClick={() => run(() => actions.refreshFlight(travelId))}
      disabled={pending}
      aria-label="Refresh flight from provider"
      className="flex items-center gap-1.5 rounded-[10px] border border-line bg-card px-3 py-1.5 text-xs font-extrabold text-ink2 disabled:opacity-50"
    >
      <span className={cn(pending && "inline-block animate-spin")} aria-hidden>↻</span> {pending ? "Refreshing…" : "Refresh"}
    </button>
  );
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
      className={cn("zc-chip", current && "border-honey bg-[color-mix(in_srgb,var(--honey)_16%,transparent)]")}
    >
      <span className="text-lg" aria-hidden>{emoji}</span>
      {name}
    </button>
  );
}
