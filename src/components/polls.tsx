"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { useAction } from "@/lib/use-action";
import * as actions from "@/lib/actions";
import { EmptyState } from "@/components/ui";
import type { PollView } from "@/lib/repo/types";

function PollCard({ poll, meId, isAdmin }: { poll: PollView; meId: string; isAdmin: boolean }) {
  const { run } = useAction();
  const canManage = poll.created_by === meId || isAdmin;
  const closed = poll.closed;

  return (
    <div className={cn("zc-card p-4", closed && "opacity-90")}>
      <div className="flex items-start justify-between gap-2">
        <div className="disp text-[17px] font-extrabold leading-tight">{poll.question}</div>
        {closed && <span className="mono flex-none rounded-full bg-chip px-2 py-0.5 text-[10px] font-bold uppercase text-muted">Closed</span>}
      </div>
      <div className="mono mt-1 text-[11px] text-muted">{poll.total} vote{poll.total === 1 ? "" : "s"}{poll.creator ? ` · by ${poll.creator.name}` : ""}</div>

      <div className="mt-3 flex flex-col gap-2">
        {poll.options.map((o) => {
          const pct = poll.total ? Math.round((o.votes / poll.total) * 100) : 0;
          const mine = poll.myOptionId === o.id;
          const disabled = closed;
          return (
            <button
              key={o.id}
              disabled={disabled}
              onClick={() => run(() => actions.votePoll(poll.id, o.id))}
              className={cn(
                "relative overflow-hidden rounded-xl border-[1.5px] px-3.5 py-2.5 text-left transition-colors disabled:cursor-default",
                mine ? "border-honey" : "border-line",
              )}
            >
              <span
                className={cn("absolute inset-y-0 left-0 transition-all", mine ? "bg-[color-mix(in_srgb,var(--honey)_20%,transparent)]" : "bg-chip")}
                style={{ width: `${pct}%` }}
                aria-hidden
              />
              <span className="relative flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[14px] font-extrabold">
                  {mine && <span aria-hidden>✓</span>}
                  {o.label}
                </span>
                <span className="mono text-[12px] font-semibold text-muted">{pct}% · {o.votes}</span>
              </span>
            </button>
          );
        })}
      </div>

      {canManage && (
        <div className="mt-3 flex gap-2">
          <button onClick={() => run(() => actions.setPollClosed(poll.id, !closed))} className="whitespace-nowrap rounded-[10px] border border-honey px-3 py-1.5 text-xs font-extrabold text-honey">
            {closed ? "Reopen" : "Close voting"}
          </button>
          <button onClick={() => { if (confirm("Delete this poll?")) run(() => actions.deletePoll(poll.id)); }} className="whitespace-nowrap rounded-[10px] border border-berry px-3 py-1.5 text-xs font-extrabold text-berry">
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function NewPoll({ onDone }: { onDone: () => void }) {
  const { run, pending } = useAction();
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);

  const setOpt = (i: number, v: string) => setOptions((o) => o.map((x, idx) => (idx === i ? v : x)));

  return (
    <form
      className="zc-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => actions.createPoll({ question, options }), {
          onSuccess: (r) => { if (r.ok) { setQuestion(""); setOptions(["", ""]); onDone(); } },
        });
      }}
    >
      <label className="zc-label">Question</label>
      <input className="zc-input" autoFocus placeholder="e.g. Where for dinner Friday?" value={question} onChange={(e) => setQuestion(e.target.value)} />
      <label className="zc-label">Options</label>
      <div className="flex flex-col gap-2">
        {options.map((o, i) => (
          <input key={i} className="zc-input" placeholder={`Option ${i + 1}`} value={o} onChange={(e) => setOpt(i, e.target.value)} />
        ))}
      </div>
      {options.length < 6 && (
        <button type="button" onClick={() => setOptions((o) => [...o, ""])} className="mt-2 text-sm font-extrabold text-honey">+ Add option</button>
      )}
      <button className="zc-btn mt-4 w-full py-2.5 text-sm" disabled={pending}>Post poll</button>
    </form>
  );
}

export function PollsClient({ polls, meId, isAdmin }: { polls: PollView[]; meId: string; isAdmin: boolean }) {
  const [creating, setCreating] = useState(false);

  return (
    <div>
      {creating ? (
        <div className="mb-4"><NewPoll onDone={() => setCreating(false)} /></div>
      ) : (
        <button onClick={() => setCreating(true)} className="zc-btn mb-4 w-full py-3 text-sm">+ New poll</button>
      )}

      {polls.length === 0 ? (
        <EmptyState emoji="📊" title="No polls yet" hint="Start one to settle a family decision." />
      ) : (
        <div className="flex flex-col gap-3">
          {polls.map((p) => <PollCard key={p.id} poll={p} meId={meId} isAdmin={isAdmin} />)}
        </div>
      )}
    </div>
  );
}
