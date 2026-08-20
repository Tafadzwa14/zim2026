"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { ThemeToggle } from "@/components/providers";
import { Sheet } from "@/components/sheet";
import { Realtime } from "@/components/realtime";
import { AnnouncementForm, PlanForm, ShoppingForm, TaskForm, TravelForm } from "@/components/forms";
import type { Place, PublicUser } from "@/lib/types";

type SheetKind = "menu" | "plan" | "travel" | "shopping" | "task" | "ann" | null;


export function AppFrame({
  user,
  users,
  places,
  appTitle,
  isMemory,
  counts,
  children,
}: {
  user: PublicUser;
  users: PublicUser[];
  places: Place[];
  appTitle: string;
  isMemory: boolean;
  counts: { pickups: number; shopping: number; tasks: number };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [sheet, setSheet] = useState<SheetKind>(null);
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  // Family is admin-only; non-admins get Info in that bottom-nav slot instead.
  const bottomNav = [
    { href: "/", icon: "🏠", label: "Home" },
    { href: "/calendar", icon: "📅", label: "Calendar" },
    { href: "/flights", icon: "✈️", label: "Flights" },
    user.is_admin
      ? { href: "/family", icon: "👥", label: "Family" }
      : { href: "/info", icon: "ℹ️", label: "Info" },
    { href: "/more", icon: "☰", label: "More" },
  ];

  const sideNav = [
    { href: "/", icon: "🏠", label: "Command centre" },
    { href: "/calendar", icon: "📅", label: "Calendar & plans" },
    { href: "/flights", icon: "✈️", label: "Flights", badge: counts.pickups },
    ...(user.is_admin ? [{ href: "/family", icon: "👥", label: "Family" }] : []),
    { href: "/shopping", icon: "🛒", label: "Shopping", badge: counts.shopping },
    { href: "/tasks", icon: "✅", label: "Tasks", badge: counts.tasks },
    { href: "/photos", icon: "📷", label: "Photos" },
    { href: "/info", icon: "ℹ️", label: "Important info" },
    { href: "/activity", icon: "🔔", label: "Activity" },
    ...(user.is_admin ? [{ href: "/admin", icon: "🛡️", label: "Admin" }] : []),
  ];

  const close = () => setSheet(null);

  return (
    <div className="lg:flex lg:h-dvh">
      <Realtime enabled={!isMemory} />

      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-[238px] flex-none flex-col border-r border-line bg-card p-[14px_14px_20px] lg:flex">
        <div className="px-2.5 pb-1 pt-1">
          <div className="disp text-[22px] font-extrabold tracking-tight">{appTitle}</div>
          <div className="mono mt-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted">Family command centre</div>
        </div>
        <nav className="mt-5 flex flex-col gap-0.5">
          {sideNav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-extrabold",
                active(n.href) ? "bg-[color-mix(in_srgb,var(--honey)_15%,transparent)] text-honey" : "text-ink2 hover:bg-chip"
              )}
            >
              <span className="w-[22px] text-center text-lg" aria-hidden>{n.icon}</span>
              {n.label}
              {"badge" in n && n.badge ? <span className="ml-auto rounded-full bg-honey px-2 py-px text-[11px] font-extrabold text-white">{n.badge}</span> : null}
            </Link>
          ))}
        </nav>
        <button onClick={() => setSheet("menu")} className="zc-btn mt-4 py-3 text-sm">＋ Add to Zim 2026</button>
        <div className="mt-auto flex items-center gap-2.5">
          <Link href="/profile" className="flex flex-1 items-center gap-2.5 rounded-xl border border-line bg-paper p-2.5">
            <span className="text-2xl" aria-hidden>{user.emoji}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-extrabold">{user.name}</span>
              <span className="mono block text-[10px] text-muted">@{user.username}{user.is_admin ? " · ADMIN" : ""}</span>
            </span>
          </Link>
          <ThemeToggle className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-line bg-paper text-lg" />
        </div>
      </aside>

      {/* main */}
      <div className="min-w-0 flex-1 lg:h-dvh lg:overflow-y-auto">
        <main className="pb-28 lg:pb-12">{children}</main>
      </div>

      {/* mobile FAB */}
      <button
        onClick={() => setSheet("menu")}
        aria-label="Add"
        className="fixed bottom-[78px] right-4 z-[35] flex h-14 w-14 items-center justify-center rounded-[19px] bg-honey text-3xl text-white shadow-[0_12px_24px_-8px_rgba(47,111,143,.8)] active:scale-90 lg:hidden"
      >
        +
      </button>

      {/* mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-line bg-card px-1 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 lg:hidden">
        {bottomNav.map((n) => (
          <Link key={n.href} href={n.href} className={cn("flex flex-1 flex-col items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-extrabold", active(n.href) ? "text-honey" : "text-[#9aa6b5]")}>
            <span className="text-xl leading-none" aria-hidden>{n.icon}</span>
            {n.label}
          </Link>
        ))}
      </nav>

      {/* add menu + forms */}
      <Sheet open={sheet === "menu"} onClose={close} title="Add to Zim 2026">
        <div className="flex flex-col gap-0">
          {[
            { k: "plan", ic: "📅", l: "Plan" },
            { k: "travel", ic: "✈️", l: "Travel" },
            { k: "shopping", ic: "🛒", l: "Shopping item" },
            { k: "task", ic: "✅", l: "Task" },
            ...(user.is_admin ? [{ k: "ann", ic: "📢", l: "Announcement" }] : []),
          ].map((o) => (
            <button key={o.k} onClick={() => setSheet(o.k as SheetKind)} className="flex items-center gap-3.5 border-b border-line2 py-4 text-left last:border-0">
              <span className="w-6 text-center text-xl" aria-hidden>{o.ic}</span>
              <span className="flex-1 text-[15px] font-extrabold">{o.l}</span>
              <span className="text-muted">›</span>
            </button>
          ))}
        </div>
      </Sheet>
      <Sheet open={sheet === "plan"} onClose={close} title="New plan"><PlanForm me={user} users={users} places={places} onDone={close} /></Sheet>
      <Sheet open={sheet === "travel"} onClose={close} title="Add travel"><TravelForm me={user} users={users} onDone={close} /></Sheet>
      <Sheet open={sheet === "shopping"} onClose={close} title="Add shopping item"><ShoppingForm me={user} users={users} onDone={close} /></Sheet>
      <Sheet open={sheet === "task"} onClose={close} title="Add task"><TaskForm onDone={close} /></Sheet>
      {user.is_admin && <Sheet open={sheet === "ann"} onClose={close} title="New announcement"><AnnouncementForm onDone={close} /></Sheet>}
    </div>
  );
}
