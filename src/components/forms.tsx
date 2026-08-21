"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { CATEGORIES } from "@/lib/display";
import { useAction } from "@/lib/use-action";
import * as actions from "@/lib/actions";
import { Spinner } from "@/components/ui";
import { isoToTripInput, tripInputToIso } from "@/lib/format";
import type { NewLegInput, TaskView } from "@/lib/repo/types";
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
        className={cn("relative h-7 w-[46px] flex-none rounded-full transition-colors", on ? "bg-good" : "bg-[#cdd5df] dark:bg-[#33404f]")}
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
              on ? "border-honey bg-[color-mix(in_srgb,var(--honey)_15%,transparent)] text-honey" : "border-line bg-card"
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
          <button key={c.id} type="button" onClick={() => setCategory(c.id)} className={cn("flex items-center gap-1.5 rounded-xl border-[1.5px] px-3 py-2 text-[13px] font-extrabold", category === c.id ? "border-honey bg-[color-mix(in_srgb,var(--honey)_15%,transparent)] text-honey" : "border-line bg-card")}>
            <span aria-hidden>{c.icon}</span> {c.label}
          </button>
        ))}
      </div>
      <label className="zc-label">Who&apos;s going?</label>
      <PeoplePicker users={users} value={attendees} onChange={setAttendees} lock={me.id} />
      <Toggle on={anyone} onToggle={() => setAnyone(!anyone)} label="Anyone can join" />
      <label className="zc-label">Notes (optional)</label>
      <textarea className="zc-input min-h-16" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      <button className="zc-btn mt-5 w-full" disabled={pending}>{pending && <Spinner />}{pending ? "Creating…" : "Create plan"}</button>
    </form>
  );
}

function LegCard({ leg, index, onChange, onRemove }: { leg: NewLegInput; index: number; onChange: (patch: Partial<NewLegInput>) => void; onRemove: () => void }) {
  return (
    <div className="zc-card mt-2 border-[color-mix(in_srgb,var(--honey)_35%,transparent)] bg-[color-mix(in_srgb,var(--honey)_16%,transparent)] p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="mono text-[11px] font-extrabold text-ink2">Leg {index + 1}</span>
        <button type="button" onClick={onRemove} className="text-xs font-extrabold text-berry">Remove</button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="zc-label">Flight</label><input className="zc-input uppercase" value={leg.flight_number} onChange={(e) => onChange({ flight_number: e.target.value.toUpperCase() })} /></div>
        <div><label className="zc-label">Airline</label><input className="zc-input" value={leg.airline_name ?? ""} onChange={(e) => onChange({ airline_name: e.target.value })} /></div>
        <div><label className="zc-label">From</label><input className="zc-input uppercase" value={leg.origin_airport} onChange={(e) => onChange({ origin_airport: e.target.value.toUpperCase() })} /></div>
        <div><label className="zc-label">To</label><input className="zc-input uppercase" value={leg.destination_airport} onChange={(e) => onChange({ destination_airport: e.target.value.toUpperCase() })} /></div>
      </div>
      <label className="zc-label">Departs</label>
      <input type="datetime-local" className="zc-input" value={isoToTripInput(leg.scheduled_departure)} onChange={(e) => onChange({ scheduled_departure: tripInputToIso(e.target.value) })} />
      <label className="zc-label">Arrives</label>
      <input type="datetime-local" className="zc-input" value={isoToTripInput(leg.scheduled_arrival)} onChange={(e) => onChange({ scheduled_arrival: tripInputToIso(e.target.value) })} />
    </div>
  );
}

export function TravelForm({ me, users, onDone }: FormProps) {
  const { run, pending } = useAction();
  const [travellers, setTravellers] = useState<string[]>([me.id]);
  const [pickup, setPickup] = useState(false);
  const [legs, setLegs] = useState<NewLegInput[]>([]);
  const [flightNo, setFlightNo] = useState("");
  const [date, setDate] = useState(todayInput());
  const [searching, setSearching] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const updateLeg = (i: number, patch: Partial<NewLegInput>) => setLegs((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const removeLeg = (i: number) => setLegs((ls) => ls.filter((_, idx) => idx !== i));

  async function search() {
    setSearching(true);
    setError(null);
    const res = await actions.searchFlightAction(flightNo, date);
    setSearching(false);
    if (res.ok === false) { setError(res.message); return; }
    const r = res.results[0];
    setLegs((ls) => [...ls, {
      leg_order: ls.length, flight_number: r.flightNumber, airline_code: r.airlineCode, airline_name: r.airlineName,
      origin_airport: r.departure.airport, origin_city: r.departure.city, destination_airport: r.arrival.airport, destination_city: r.arrival.city,
      scheduled_departure: r.departure.scheduledTime, scheduled_arrival: r.arrival.scheduledTime, estimated_arrival: r.arrival.estimatedTime,
      terminal_departure: r.departure.terminal, aircraft_type: r.aircraftType, aircraft_type_code: r.aircraftTypeCode, aircraft_registration: r.aircraftRegistration,
      status: r.status, provider: "provider", provider_flight_id: r.providerFlightId,
    }]);
    setFlightNo("");
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await actions.parseItinerary(fd);
    setUploading(false);
    if (res.ok === false) { setError(res.message); return; }
    setLegs(res.legs);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!legs.length) { setError("Add at least one flight — upload an itinerary or search by number"); return; }
        run(() => actions.createTravel({ travellers, pickup, legs: legs.map((l, i) => ({ ...l, leg_order: i })) }), { onSuccess: onDone });
      }}
    >
      <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="zc-btn w-full py-3 text-sm">
        {uploading ? "Reading itinerary…" : "📄 Upload itinerary PDF"}
      </button>
      <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={onFile} />
      <p className="mt-1.5 text-center text-[11px] text-muted">Reads every leg, layovers included. Check them below before saving.</p>

      <div className="my-3 flex items-center gap-3 text-[11px] font-bold text-muted"><span className="h-px flex-1 bg-line" />OR ADD BY FLIGHT NUMBER<span className="h-px flex-1 bg-line" /></div>

      <div className="grid grid-cols-2 gap-2.5">
        <div><label className="zc-label">Flight number</label><input className="zc-input uppercase" placeholder="e.g. EK713" value={flightNo} onChange={(e) => setFlightNo(e.target.value)} /></div>
        <div><label className="zc-label">Date</label><input type="date" className="zc-input" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      </div>
      <button type="button" className="zc-btn zc-btn-ghost zc-btn-sm mt-2 w-full py-2.5 text-sm" onClick={search} disabled={searching || !flightNo}>
        {searching ? "Searching…" : "🔍 Search and add leg"}
      </button>

      {error && <p className="mt-3 rounded-xl border border-[#f4dcac] bg-[#fff5e2] px-3 py-2 text-sm font-semibold text-[#b57d16]">{error}</p>}

      {legs.length > 0 && (
        <>
          <label className="zc-label mt-4">Flights ({legs.length})</label>
          {legs.map((l, i) => <LegCard key={i} leg={l} index={i} onChange={(patch) => updateLeg(i, patch)} onRemove={() => removeLeg(i)} />)}
        </>
      )}

      <label className="zc-label mt-4">Who&apos;s travelling?</label>
      <PeoplePicker users={users} value={travellers} onChange={setTravellers} />
      <Toggle on={pickup} onToggle={() => setPickup(!pickup)} label="Need airport pickup?" />
      <button className="zc-btn mt-5 w-full" disabled={pending}>{pending && <Spinner />}{pending ? "Adding…" : "Add travel"}</button>
    </form>
  );
}

export function ShoppingForm({ me, users, onDone }: { me: PublicUser; users: PublicUser[]; onDone: () => void }) {
  const { run, pending } = useAction();
  const [form, setForm] = useState<{ item: string; quantity: number; category: string; assignTo: string | null }>({
    item: "", quantity: 1, category: "Groceries", assignTo: null,
  });
  const [added, setAdded] = useState(0);
  const itemRef = useRef<HTMLInputElement>(null);
  // Quick-add: after each item we clear the name and refocus, keeping the
  // category and the "for" tag, so a whole list can be entered in one go.
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.item.trim()) return;
    run(() => actions.addShopping(form), {
      silent: true,
      onSuccess: () => {
        setForm((f) => ({ ...f, item: "", quantity: 1 }));
        setAdded((n) => n + 1);
        itemRef.current?.focus();
      },
    });
  };
  return (
    <form onSubmit={submit}>
      <label className="zc-label">Item</label>
      <input ref={itemRef} className="zc-input" autoFocus placeholder="e.g. Coke" value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} />
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
      <label className="zc-label">For (optional)</label>
      <div className="flex flex-wrap gap-2">
        {[{ id: null as string | null, emoji: "🤷", name: "Anyone" }, ...users].map((u) => {
          const on = form.assignTo === u.id;
          const label = u.id === me.id ? "Me" : u.name;
          return (
            <button
              key={u.id ?? "none"}
              type="button"
              onClick={() => setForm({ ...form, assignTo: u.id })}
              className={cn("flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-[13px] font-extrabold", on ? "border-honey bg-[color-mix(in_srgb,var(--honey)_15%,transparent)] text-honey" : "border-line bg-card")}
            >
              <span className="text-base" aria-hidden>{u.emoji}</span>
              {label}
            </button>
          );
        })}
      </div>
      <button className="zc-btn mt-5 w-full" disabled={pending || !form.item.trim()}>Add to list</button>
      <div className="mt-2.5 flex items-center justify-between text-xs font-semibold text-muted">
        <span>{added > 0 ? `${added} added — keep going or close` : "Press enter to add and keep the sheet open"}</span>
        {added > 0 && <button type="button" className="zc-btn zc-btn-ghost px-3 py-1" onClick={onDone}>Done</button>}
      </div>
    </form>
  );
}

/** Add a task, or edit an existing one when `task` is supplied. */
export function TaskForm({ task, onDone }: { task?: TaskView; onDone: () => void }) {
  const { run, pending } = useAction();
  const editing = Boolean(task);
  const [form, setForm] = useState({ title: task?.title ?? "", due_date: task?.due_date ?? "", notes: task?.notes ?? "" });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { title: form.title, due_date: form.due_date || null, notes: form.notes || null };
    run(() => (task ? actions.editTask(task.id, payload) : actions.addTask(payload)), { onSuccess: onDone });
  };
  return (
    <form onSubmit={submit}>
      <label className="zc-label">Task</label>
      <input className="zc-input" autoFocus placeholder="e.g. Pick up drinks" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <label className="zc-label">Due date (optional)</label>
      <input type="date" className="zc-input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
      <label className="zc-label">Notes (optional)</label>
      <textarea className="zc-input min-h-16" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      <button className="zc-btn mt-5 w-full" disabled={pending || !form.title.trim()}>{pending && <Spinner />}{pending ? "Saving…" : editing ? "Save changes" : "Add task"}</button>
    </form>
  );
}

export function AnnouncementForm({ onDone }: { onDone: () => void }) {
  const { run, pending } = useAction();
  const [form, setForm] = useState({ title: "", content: "", expiry: "" });
  const [pinned, setPinned] = useState(true);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        // Expiry is end-of-day on the chosen date.
        const expires_at = form.expiry ? new Date(`${form.expiry}T23:59:59`).toISOString() : null;
        run(() => actions.addAnnouncement({ title: form.title, content: form.content || null, is_pinned: pinned, expires_at }), { onSuccess: onDone });
      }}
    >
      <label className="zc-label">Title</label>
      <input className="zc-input" autoFocus placeholder="e.g. Tailor tomorrow 10 AM" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
      <label className="zc-label">Details (optional)</label>
      <textarea className="zc-input min-h-16" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
      <label className="zc-label">Auto-remove after (optional)</label>
      <input type="date" className="zc-input" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} />
      <p className="mt-1 text-xs text-muted">Leave blank to keep it until you remove it.</p>
      <Toggle on={pinned} onToggle={() => setPinned(!pinned)} label="📌 Pin to Home" />
      <button className="zc-btn mt-5 w-full" disabled={pending}>{pending && <Spinner />}{pending ? "Posting…" : "Post announcement"}</button>
    </form>
  );
}
