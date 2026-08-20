"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { CATEGORIES } from "@/lib/display";
import { fmtTime } from "@/lib/format";
import { useAction } from "@/lib/use-action";
import * as actions from "@/lib/actions";
import type { NewLegInput } from "@/lib/repo/types";
import type { FlightSearchResult } from "@/lib/flights";
import type { Place, PlanCategory, PublicUser } from "@/lib/types";

const todayInput = () => new Date().toLocaleDateString("en-CA");

interface FormProps {
  me: PublicUser;
  users: PublicUser[];
  places?: Place[];
  onDone: () => void;
}

function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <div className="zc-card mt-3.5 flex items-center justify-between border-[1.5px] p-3.5">
      <span className="text-sm font-extrabold">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={onToggle}
        className={cn("relative h-7 w-[46px] flex-none rounded-full transition-colors", on ? "bg-good" : "bg-[#e0d5c2]")}
      >
        <span className={cn("absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white transition-all", on ? "left-[21px]" : "left-[3px]")} />
      </button>
    </div>
  );
}

function PeoplePicker({ users, value, onChange, lock }: { users: PublicUser[]; value: string[]; onChange: (v: string[]) => void; lock?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {users.map((u) => {
        const on = value.includes(u.id);
        return (
          <button
            key={u.id}
            type="button"
            onClick={() => {
              if (u.id === lock) return;
              onChange(on ? value.filter((x) => x !== u.id) : [...value, u.id]);
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-[13px] font-extrabold",
              on ? "border-honey bg-[#fbecd8] text-[#8a5115] dark:bg-[color-mix(in_srgb,var(--honey)_22%,transparent)] dark:text-ink" : "border-line bg-card"
            )}
          >
            <span className="text-base" aria-hidden>{u.emoji}</span>
            {u.name}
          </button>
        );
      })}
    </div>
  );
}

export function PlanForm({ me, users, places = [], onDone }: FormProps) {
  const { run, pending } = useAction();
  const [category, setCategory] = useState<PlanCategory>("family");
  const [attendees, setAttendees] = useState<string[]>([me.id]);
  const [anyone, setAnyone] = useState(true);
  const [form, setForm] = useState({ title: "", date: todayInput(), time: "", location: "", notes: "" });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => actions.createPlan({ title: form.title, category, date: form.date, start_time: form.time || null, location: form.location || null, notes: form.notes || null, anyone_can_join: anyone, attendees }), { onSuccess: onDone });
      }}
    >
      <label className="zc-label">What&apos;s the plan?</label>
      <input className="zc-input" autoFocus placeholder="e.g. Family lunch" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="zc-label">Date</label>
          <input type="date" className="zc-input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
        </div>
        <div>
          <label className="zc-label">Time</label>
          <input type="time" className="zc-input" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
        </div>
      </div>
      <label className="zc-label">Location (optional)</label>
      <input className="zc-input" list="plan-places" placeholder="Where?" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
      {places.length > 0 && <datalist id="plan-places">{places.map((p) => <option key={p.id} value={p.name} />)}</datalist>}
      <label className="zc-label">Category</label>
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => (
          <button key={c.id} type="button" onClick={() => setCategory(c.id)} className={cn("flex items-center gap-1.5 rounded-xl border-[1.5px] px-3 py-2 text-[13px] font-extrabold", category === c.id ? "border-honey bg-[#fbecd8] text-[#8a5115] dark:bg-[color-mix(in_srgb,var(--honey)_22%,transparent)] dark:text-ink" : "border-line bg-card")}>
            <span aria-hidden>{c.icon}</span> {c.label}
          </button>
        ))}
      </div>
      <label className="zc-label">Who&apos;s going?</label>
      <PeoplePicker users={users} value={attendees} onChange={setAttendees} lock={me.id} />
      <Toggle on={anyone} onToggle={() => setAnyone(!anyone)} label="Anyone can join" />
      <label className="zc-label">Notes (optional)</label>
      <textarea className="zc-input min-h-16" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      <button className="zc-btn mt-5 w-full" disabled={pending}>Create plan</button>
    </form>
  );
}

export function TravelForm({ me, users, onDone }: FormProps) {
  const { run, pending } = useAction();
  const [travellers, setTravellers] = useState<string[]>([me.id]);
  const [pickup, setPickup] = useState(false);
  const [flightNo, setFlightNo] = useState("");
  const [date, setDate] = useState(todayInput());
  const [searching, setSearching] = useState(false);
  const [leg, setLeg] = useState<(NewLegInput & { found: FlightSearchResult }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setSearching(true);
    setError(null);
    const res = await actions.searchFlightAction(flightNo, date);
    setSearching(false);
    if (res.ok === false) {
      setLeg(null);
      setError(res.message);
      return;
    }
    const r = res.results[0];
    setLeg({
      leg_order: 0, flight_number: r.flightNumber, airline_code: r.airlineCode, airline_name: r.airlineName,
      origin_airport: r.departure.airport, origin_city: r.departure.city, destination_airport: r.arrival.airport, destination_city: r.arrival.city,
      scheduled_departure: r.departure.scheduledTime, scheduled_arrival: r.arrival.scheduledTime, estimated_arrival: r.arrival.estimatedTime,
      terminal_departure: r.departure.terminal, aircraft_type: r.aircraftType, aircraft_type_code: r.aircraftTypeCode, aircraft_registration: r.aircraftRegistration,
      status: r.status, provider: "provider", provider_flight_id: r.providerFlightId, found: r,
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!leg) {
          setError("Search a flight first");
          return;
        }
        const { found: _f, ...legInput } = leg;
        void _f;
        run(() => actions.createTravel({ travellers, pickup, legs: [legInput] }), { onSuccess: onDone });
      }}
    >
      <label className="zc-label">Flight number</label>
      <input className="zc-input uppercase" placeholder="e.g. EK713" value={flightNo} onChange={(e) => setFlightNo(e.target.value)} />
      <label className="zc-label">Flight date</label>
      <input type="date" className="zc-input" value={date} onChange={(e) => setDate(e.target.value)} />
      <button type="button" className="zc-btn zc-btn-ghost zc-btn-sm mt-3 w-full py-2.5 text-sm" onClick={search} disabled={searching || !flightNo}>
        {searching ? "Searching…" : "🔍 Search flight"}
      </button>
      {error && <p className="mt-3 rounded-xl border border-[#f4dcac] bg-[#fff5e2] px-3 py-2 text-sm font-semibold text-[#b57d16]">{error}</p>}
      {leg && (
        <div className="zc-card mt-3 border-[#eecfa3] bg-[#fbecd8] p-4 dark:bg-[color-mix(in_srgb,var(--honey)_16%,transparent)]">
          <div className="flex items-center justify-between">
            <b className="mono">{leg.flight_number} · {leg.airline_name}</b>
            <span className="rounded-full bg-chip px-2.5 py-1 text-[11px] font-extrabold text-ink2">✓ Found</span>
          </div>
          <div className="mt-2 flex items-end justify-between">
            <div><div className="mono text-2xl font-semibold">{leg.origin_airport}</div><div className="text-[11px] text-muted">{leg.origin_city}</div></div>
            <div className="text-right"><div className="mono text-2xl font-semibold">{leg.destination_airport}</div><div className="text-[11px] text-muted">{leg.destination_city}</div></div>
          </div>
          <div className="mt-2 text-xs font-semibold text-muted">{fmtTime(leg.scheduled_departure ?? null)} → {fmtTime(leg.scheduled_arrival ?? null)} · {leg.aircraft_type ?? "—"}</div>
        </div>
      )}
      <label className="zc-label">Who&apos;s travelling?</label>
      <PeoplePicker users={users} value={travellers} onChange={setTravellers} />
      <Toggle on={pickup} onToggle={() => setPickup(!pickup)} label="Need airport pickup?" />
      <button className="zc-btn mt-5 w-full" disabled={pending}>Add travel</button>
    </form>
  );
}

export function ShoppingForm({ onDone }: { onDone: () => void }) {
  const { run, pending } = useAction();
  const [form, setForm] = useState({ item: "", quantity: 1, category: "Groceries" });
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => actions.addShopping(form), { onSuccess: onDone }); }}>
      <label className="zc-label">Item</label>
      <input className="zc-input" autoFocus placeholder="e.g. Coke" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className="zc-label">Quantity</label>
          <input type="number" min={1} className="zc-input" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: +e.target.value })} />
        </div>
        <div>
          <label className="zc-label">Category</label>
          <select className="zc-input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option>Groceries</option><option>Wedding</option><option>House</option><option>Other</option>
          </select>
        </div>
      </div>
      <button className="zc-btn mt-5 w-full" disabled={pending}>Add to list</button>
    </form>
  );
}

export function TaskForm({ onDone }: { onDone: () => void }) {
  const { run, pending } = useAction();
  const [form, setForm] = useState({ title: "", due_date: "", notes: "" });
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => actions.addTask({ title: form.title, due_date: form.due_date || null, notes: form.notes || null }), { onSuccess: onDone }); }}>
      <label className="zc-label">Task</label>
      <input className="zc-input" autoFocus placeholder="e.g. Pick up drinks" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <label className="zc-label">Due date (optional)</label>
      <input type="date" className="zc-input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
      <label className="zc-label">Notes (optional)</label>
      <textarea className="zc-input min-h-16" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      <button className="zc-btn mt-5 w-full" disabled={pending}>Add task</button>
    </form>
  );
}

export function AnnouncementForm({ onDone }: { onDone: () => void }) {
  const { run, pending } = useAction();
  const [form, setForm] = useState({ title: "", content: "" });
  const [pinned, setPinned] = useState(true);
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => actions.addAnnouncement({ title: form.title, content: form.content || null, is_pinned: pinned }), { onSuccess: onDone }); }}>
      <label className="zc-label">Title</label>
      <input className="zc-input" autoFocus placeholder="e.g. Tailor tomorrow 10 AM" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <label className="zc-label">Details (optional)</label>
      <textarea className="zc-input min-h-16" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
      <Toggle on={pinned} onToggle={() => setPinned(!pinned)} label="📌 Pin to Home" />
      <button className="zc-btn mt-5 w-full" disabled={pending}>Post announcement</button>
    </form>
  );
}
