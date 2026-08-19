import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { PublicUser } from "@/lib/types";

export function Avatar({ user, size = 20 }: { user: Pick<PublicUser, "emoji" | "name"> | null; size?: number }) {
  return (
    <span role="img" aria-label={user?.name ?? "Someone"} style={{ fontSize: size }}>
      {user?.emoji ?? "👤"}
    </span>
  );
}

export function PersonChip({ user }: { user: PublicUser }) {
  return (
    <span className="zc-chip">
      <span className="text-lg" aria-hidden>
        {user.emoji}
      </span>
      {user.name}
    </span>
  );
}

export function SectionHeader({ children, meta }: { children: ReactNode; meta?: ReactNode }) {
  return (
    <div className="mt-6 mb-3 flex items-center gap-2">
      <h2 className="disp text-lg font-extrabold">{children}</h2>
      {meta && <span className="mono ml-auto flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted">{meta}</span>}
    </div>
  );
}

export function StatusPill({ tone, children }: { tone: "here" | "air" | "up"; children: ReactNode }) {
  const cls = {
    here: "text-good bg-[color-mix(in_srgb,var(--good)_16%,transparent)]",
    air: "text-honey bg-[color-mix(in_srgb,var(--honey)_16%,transparent)]",
    up: "text-[#5f86a8] bg-[#e6eef5] dark:bg-[#1a2740] dark:text-[#8fb4d8]",
  }[tone];
  return <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-extrabold", cls)}>{children}</span>;
}

export function CatPill({ icon, label }: { icon: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-chip px-2.5 py-1 text-[11px] font-extrabold text-ink2">
      <span aria-hidden>{icon}</span>
      {label}
    </span>
  );
}

export function EmptyState({ emoji, title, hint }: { emoji: string; title: string; hint?: ReactNode }) {
  return (
    <div className="zc-card flex flex-col items-center px-6 py-9 text-center">
      <div className="text-4xl" aria-hidden>
        {emoji}
      </div>
      <div className="disp mt-2 text-lg font-extrabold">{title}</div>
      {hint && <div className="mt-1 text-sm text-ink2">{hint}</div>}
    </div>
  );
}

export function LiveDot() {
  return <span className="zc-pulse inline-block h-[7px] w-[7px] rounded-full bg-good shadow-[0_0_7px_var(--good)]" />;
}

export function Screen({ title, sub, action, children }: { title: ReactNode; sub?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-[18px] pt-4 lg:max-w-3xl lg:px-8 lg:pt-7">
      <div className="flex items-start justify-between gap-2.5">
        <div>
          <h1 className="disp text-[26px] font-extrabold tracking-tight lg:text-3xl">{title}</h1>
          {sub && <div className="mono mt-1 text-[11px] uppercase tracking-wide text-muted">{sub}</div>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export function List({ children }: { children: ReactNode }) {
  return <div className="zc-card overflow-hidden p-0">{children}</div>;
}

export function BackHeader({ title, href = "/more" }: { title: string; href?: string }) {
  return (
    <div className="sticky top-0 z-20 flex items-center gap-2.5 bg-paper px-1 pb-1.5 pt-4">
      <Link href={href} aria-label="Back" className="flex h-9 w-9 flex-none items-center justify-center rounded-xl border border-line bg-card text-xl">
        ‹
      </Link>
      <h1 className="disp text-xl font-extrabold">{title}</h1>
    </div>
  );
}
