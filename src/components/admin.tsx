"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { useAction } from "@/lib/use-action";
import * as actions from "@/lib/actions";
import { ROLES } from "@/lib/types";
import type { FlightLeg, ImportantInfo, Place } from "@/lib/types";
import type { InfoGroup, RosterUser } from "@/lib/repo/types";

function SmallBtn({ onClick, children, tone = "outline", disabled }: { onClick: () => void; children: React.ReactNode; tone?: "outline" | "danger" | "solid"; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "whitespace-nowrap rounded-[10px] px-3 py-1.5 text-xs font-extrabold disabled:opacity-50",
        tone === "danger" && "border border-berry text-berry",
        tone === "solid" && "bg-honey text-white",
        tone === "outline" && "border border-honey text-honey",
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------- roster
export function AddPersonForm() {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [admin, setAdmin] = useState(false);

  if (!open) {
    return <button onClick={() => setOpen(true)} className="zc-btn w-full py-3 text-sm">+ Add a person</button>;
  }
  return (
    <form
      className="zc-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => actions.adminAddPerson({ name, username, is_admin: admin }), {
          onSuccess: (r) => { if (r.ok) { setName(""); setUsername(""); setAdmin(false); setOpen(false); } },
        });
      }}
    >
      <label className="zc-label">Name</label>
      <input className="zc-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Auntie Grace" />
      <label className="zc-label">Username</label>
      <input className="zc-input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="what they'll type to reclaim" />
      <label className="mt-3 flex items-center gap-2 text-sm font-bold">
        <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} /> Make them an admin
      </label>
      <div className="mt-4 flex gap-2">
        <button className="zc-btn flex-1 py-2.5 text-sm" disabled={pending}>Add person</button>
        <button type="button" onClick={() => setOpen(false)} className="zc-btn zc-btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
      </div>
    </form>
  );
}

export function RosterRow({ u, meId }: { u: RosterUser; meId: string }) {
  const { run } = useAction();
  const [open, setOpen] = useState(false);
  const [loc, setLoc] = useState(u.staying_at ?? "");
  const isSelf = u.id === meId;
  const roleLabels = ROLES.filter((r) => u.roles.includes(r.slug));

  const toggleRole = (slug: string) => {
    const next = u.roles.includes(slug) ? u.roles.filter((r) => r !== slug) : [...u.roles, slug];
    run(() => actions.adminSetRoles(u.id, next));
  };

  return (
    <div className="border-b border-line2 last:border-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-2xl" aria-hidden>{u.emoji}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[15px] font-extrabold">
            {u.name}
            {u.is_admin && <span className="mono text-[10px] text-honey">ADMIN</span>}
          </div>
          <div className="mono text-[11px] text-muted">@{u.username} · {u.status}</div>
          {(roleLabels.length > 0 || u.staying_at) && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {roleLabels.map((r) => <span key={r.slug} className="rounded-full bg-chip px-2 py-0.5 text-[10px] font-bold text-ink2">{r.emoji} {r.label}</span>)}
              {u.staying_at && <span className="text-[11px] text-muted">📍 {u.staying_at}</span>}
            </div>
          )}
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", u.claimed ? "bg-[color-mix(in_srgb,var(--good)_18%,transparent)] text-good" : "bg-chip text-muted")}>
          {u.claimed ? "Claimed" : "Pending"}
        </span>
        <button onClick={() => setOpen((v) => !v)} className="text-muted" aria-label="Manage person">{open ? "▾" : "⋯"}</button>
      </div>

      {open && (
        <div className="space-y-3 bg-chip/40 px-4 pb-4 pt-1">
          <div>
            <div className="zc-label">Roles</div>
            <div className="flex flex-wrap gap-1.5">
              {ROLES.map((r) => {
                const on = u.roles.includes(r.slug);
                return (
                  <button key={r.slug} onClick={() => toggleRole(r.slug)} className={cn("rounded-full border-[1.5px] px-2.5 py-1 text-xs font-bold", on ? "border-honey bg-[#fbecd8] text-[#8a5115] dark:bg-[color-mix(in_srgb,var(--honey)_22%,transparent)] dark:text-ink" : "border-line bg-card text-ink2")}>
                    {r.emoji} {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); run(() => actions.adminSetLocation(u.id, loc)); }}
            className="flex items-end gap-2"
          >
            <div className="flex-1">
              <div className="zc-label">Staying at</div>
              <input className="zc-input" value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="e.g. 12 Fairway Close" />
            </div>
            <SmallBtn onClick={() => run(() => actions.adminSetLocation(u.id, loc))}>Save</SmallBtn>
          </form>

          <div className="flex flex-wrap gap-2">
            {!isSelf && <SmallBtn onClick={() => run(() => actions.setAdmin(u.id, !u.is_admin))}>{u.is_admin ? "Revoke admin" : "Make admin"}</SmallBtn>}
            {u.claimed && !isSelf && <SmallBtn onClick={() => { if (confirm(`Reset ${u.name}'s PIN? They'll set a new one at login.`)) run(() => actions.adminResetPin(u.id)); }}>Reset PIN</SmallBtn>}
            {!isSelf && <SmallBtn tone="danger" onClick={() => { if (confirm(`Remove ${u.name} from the family? This can't be undone.`)) run(() => actions.adminRemovePerson(u.id)); }}>Remove</SmallBtn>}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- places
export function PlacesManager({ places }: { places: Place[] }) {
  const { run } = useAction();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  return (
    <div>
      {places.length > 0 && (
        <div className="zc-card mb-3 overflow-hidden p-0">
          {places.map((p) => (
            <div key={p.id} className="flex items-center gap-3 border-b border-line2 px-4 py-3 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-extrabold">{p.name}</div>
                {p.address && <div className="text-xs text-muted">{p.address}</div>}
              </div>
              <SmallBtn tone="danger" onClick={() => { if (confirm(`Remove ${p.name}?`)) run(() => actions.adminDeletePlace(p.id)); }}>Remove</SmallBtn>
            </div>
          ))}
        </div>
      )}
      <form
        className="zc-card p-4"
        onSubmit={(e) => { e.preventDefault(); run(() => actions.adminAddPlace({ name, address }), { onSuccess: (r) => { if (r.ok) { setName(""); setAddress(""); } } }); }}
      >
        <label className="zc-label">Place name</label>
        <input className="zc-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam Levy Village" />
        <label className="zc-label">Address (optional)</label>
        <input className="zc-input" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Borrowdale, Harare" />
        <button className="zc-btn mt-4 w-full py-2.5 text-sm">Add place</button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- flights
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const localInputToIso = (v: string): string | null => (v ? new Date(v).toISOString() : null);

const FLIGHT_STATUSES = ["scheduled", "boarding", "air", "landed", "cancelled", "diverted"] as const;

export function FlightEditForm({ leg }: { leg: FlightLeg }) {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    flight_number: leg.flight_number,
    airline_name: leg.airline_name ?? "",
    origin_airport: leg.origin_airport,
    destination_airport: leg.destination_airport,
    terminal_departure: leg.terminal_departure ?? "",
    aircraft_type: leg.aircraft_type ?? "",
    status: leg.status,
    scheduled_departure: isoToLocalInput(leg.scheduled_departure),
    scheduled_arrival: isoToLocalInput(leg.scheduled_arrival),
  });

  if (!open) return <button onClick={() => setOpen(true)} className="zc-btn zc-btn-ghost w-full py-2.5 text-sm">Admin: edit flight details ✏️</button>;

  return (
    <form
      className="zc-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => actions.adminUpdateLeg(leg.id, {
          flight_number: f.flight_number,
          airline_name: f.airline_name,
          origin_airport: f.origin_airport,
          destination_airport: f.destination_airport,
          terminal_departure: f.terminal_departure,
          aircraft_type: f.aircraft_type,
          status: f.status,
          scheduled_departure: localInputToIso(f.scheduled_departure),
          scheduled_arrival: localInputToIso(f.scheduled_arrival),
        }), { onSuccess: (r) => { if (r.ok) setOpen(false); } });
      }}
    >
      <div className="grid grid-cols-2 gap-2.5">
        <div><label className="zc-label">Flight number</label><input className="zc-input" value={f.flight_number} onChange={(e) => setF({ ...f, flight_number: e.target.value })} /></div>
        <div><label className="zc-label">Airline</label><input className="zc-input" value={f.airline_name} onChange={(e) => setF({ ...f, airline_name: e.target.value })} /></div>
        <div><label className="zc-label">From</label><input className="zc-input" value={f.origin_airport} onChange={(e) => setF({ ...f, origin_airport: e.target.value.toUpperCase() })} /></div>
        <div><label className="zc-label">To</label><input className="zc-input" value={f.destination_airport} onChange={(e) => setF({ ...f, destination_airport: e.target.value.toUpperCase() })} /></div>
        <div><label className="zc-label">Terminal</label><input className="zc-input" value={f.terminal_departure} onChange={(e) => setF({ ...f, terminal_departure: e.target.value })} /></div>
        <div><label className="zc-label">Aircraft</label><input className="zc-input" value={f.aircraft_type} onChange={(e) => setF({ ...f, aircraft_type: e.target.value })} /></div>
      </div>
      <label className="zc-label">Scheduled departure</label>
      <input type="datetime-local" className="zc-input" value={f.scheduled_departure} onChange={(e) => setF({ ...f, scheduled_departure: e.target.value })} />
      <label className="zc-label">Scheduled arrival</label>
      <input type="datetime-local" className="zc-input" value={f.scheduled_arrival} onChange={(e) => setF({ ...f, scheduled_arrival: e.target.value })} />
      <label className="zc-label">Status</label>
      <select className="zc-input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as FlightLeg["status"] })}>
        {FLIGHT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <div className="mt-4 flex gap-2">
        <button className="zc-btn flex-1 py-2.5 text-sm" disabled={pending}>Save flight</button>
        <button type="button" onClick={() => setOpen(false)} className="zc-btn zc-btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- important info
function InfoRow({ item }: { item: ImportantInfo }) {
  const { run } = useAction();
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);

  if (edit) {
    return (
      <form
        className="border-b border-line2 px-4 py-3 last:border-0"
        onSubmit={(e) => { e.preventDefault(); run(() => actions.adminUpdateInfo(item.id, { title, content }), { onSuccess: (r) => { if (r.ok) setEdit(false); } }); }}
      >
        <input className="zc-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        <input className="zc-input" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Content" />
        <div className="mt-2 flex gap-2">
          <SmallBtn tone="solid" onClick={() => run(() => actions.adminUpdateInfo(item.id, { title, content }), { onSuccess: (r) => { if (r.ok) setEdit(false); } })}>Save</SmallBtn>
          <SmallBtn onClick={() => setEdit(false)}>Cancel</SmallBtn>
        </div>
      </form>
    );
  }
  return (
    <div className="flex items-center gap-3 border-b border-line2 px-4 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-extrabold">{item.title}</div>
        <div className="text-xs text-muted">{item.content}</div>
      </div>
      <SmallBtn onClick={() => setEdit(true)}>Edit</SmallBtn>
      <SmallBtn tone="danger" onClick={() => { if (confirm(`Remove "${item.title}"?`)) run(() => actions.adminDeleteInfo(item.id)); }}>Remove</SmallBtn>
    </div>
  );
}

export function InfoManager({ groups }: { groups: InfoGroup[] }) {
  const { run } = useAction();
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const categories = groups.map((g) => g.category);

  return (
    <div>
      {groups.map((g) => (
        <div key={g.category} className="mb-3">
          <div className="zc-label">{g.category}</div>
          <div className="zc-card overflow-hidden p-0">
            {g.items.map((i) => <InfoRow key={i.id} item={i} />)}
          </div>
        </div>
      ))}
      <form
        className="zc-card p-4"
        onSubmit={(e) => { e.preventDefault(); run(() => actions.adminAddInfo({ category, title, content }), { onSuccess: (r) => { if (r.ok) { setTitle(""); setContent(""); } } }); }}
      >
        <label className="zc-label">Category</label>
        <input className="zc-input" list="info-cats" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Emergency, Home / Base, Wedding" />
        <datalist id="info-cats">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        <label className="zc-label">Title</label>
        <input className="zc-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Ambulance" />
        <label className="zc-label">Content</label>
        <input className="zc-input" value={content} onChange={(e) => setContent(e.target.value)} placeholder="e.g. 994" />
        <button className="zc-btn mt-4 w-full py-2.5 text-sm">Add info</button>
      </form>
    </div>
  );
}
