"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useAction } from "@/lib/use-action";
import * as actions from "@/lib/actions";
import { Spinner } from "@/components/ui";
import { mapsUrl } from "@/lib/maps";
import { airportInputToIso, isoToAirportInput } from "@/lib/flight-view";
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

// ---------------------------------------------------------------- tabs
export function AdminTabs({ tabs }: { tabs: { key: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.key ?? "");
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div>
      <div role="tablist" aria-label="Admin sections" className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-line bg-card p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={active === t.key}
            onClick={() => setActive(t.key)}
            className={cn(
              "whitespace-nowrap rounded-lg px-3.5 py-1.5 text-[13px] font-extrabold transition-colors",
              active === t.key ? "bg-honey text-white" : "text-muted",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {current?.content}
    </div>
  );
}

// ---------------------------------------------------------------- roster
export function AddPersonForm() {
  const { run, pending } = useAction();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [admin, setAdmin] = useState(false);
  const [invite, setInvite] = useState<{ name: string; code: string } | null>(null);

  if (!open) {
    return (
      <div className="space-y-3">
        {invite && <ClaimCodeBox name={invite.name} code={invite.code} onDone={() => setInvite(null)} />}
        <button onClick={() => setOpen(true)} className="zc-btn w-full py-3 text-sm">+ Add a person</button>
      </div>
    );
  }
  return (
    <form
      className="zc-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => actions.adminAddPerson({ name, username, is_admin: admin }), {
          onSuccess: (r) => { if (r.ok) { setInvite({ name, code: r.claimCode }); setName(""); setUsername(""); setAdmin(false); setOpen(false); } },
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
        <button className="zc-btn flex-1 py-2.5 text-sm" disabled={pending}>{pending && <Spinner />}{pending ? "Adding…" : "Add person"}</button>
        <button type="button" onClick={() => setOpen(false)} className="zc-btn zc-btn-ghost flex-1 py-2.5 text-sm">Cancel</button>
      </div>
    </form>
  );
}

function ClaimCodeBox({ name, code, onDone }: { name: string; code: string; onDone?: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="zc-card border-[color-mix(in_srgb,var(--good)_35%,var(--line))] p-4">
      <div className="text-sm font-extrabold">One-time invite for {name}</div>
      <code className="mono mt-2 block break-all rounded-xl bg-chip px-3 py-2 text-sm font-bold">{code}</code>
      <p className="mt-2 text-xs text-muted">This code is shown only now. Send it privately.</p>
      <div className="mt-3 flex gap-2">
        <SmallBtn tone="solid" onClick={async () => { await navigator.clipboard.writeText(code); setCopied(true); }}>{copied ? "Copied ✓" : "Copy code"}</SmallBtn>
        {onDone && <SmallBtn onClick={onDone}>Done</SmallBtn>}
      </div>
    </div>
  );
}

export function RosterRow({ u, meId, places }: { u: RosterUser; meId: string; places: Place[] }) {
  const { run } = useAction();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(u.phone_number ?? "");
  const [claimCode, setClaimCode] = useState<string | null>(null);
  const isSelf = u.id === meId;
  const roleLabels = ROLES.filter((r) => u.roles.includes(r.slug));

  const toggleRole = (slug: string) => {
    const next = u.roles.includes(slug) ? u.roles.filter((r) => r !== slug) : [...u.roles, slug];
    run(() => actions.adminSetRoles(u.id, next));
  };

  const savePhone = () => {
    if (phone.trim() === (u.phone_number ?? "")) return;
    run(() => actions.adminSetPhone(u.id, phone));
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
          <div className="mono text-[11px] text-muted">@{u.username}{u.status !== "here" && ` · ${u.status}`}</div>
          {u.pin_reset_requested && (
            <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--warn)_18%,transparent)] px-2 py-0.5 text-[10px] font-bold text-warn">
              ↻ PIN reset requested
            </div>
          )}
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
          {claimCode && <ClaimCodeBox name={u.name} code={claimCode} onDone={() => setClaimCode(null)} />}
          <div>
            <div className="zc-label">Roles</div>
            <div className="flex flex-wrap gap-1.5">
              {ROLES.map((r) => {
                const on = u.roles.includes(r.slug);
                return (
                  <button key={r.slug} onClick={() => toggleRole(r.slug)} className={cn("rounded-full border-[1.5px] px-2.5 py-1 text-xs font-bold", on ? "border-honey bg-[color-mix(in_srgb,var(--honey)_15%,transparent)] text-honey" : "border-line bg-card text-ink2")}>
                    {r.emoji} {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="zc-label">Staying at</div>
            <select
              className="zc-input"
              value={u.staying_at ?? ""}
              onChange={(e) => run(() => actions.adminSetLocation(u.id, e.target.value))}
            >
              <option value="">— not set —</option>
              {places.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
              {u.staying_at && !places.some((p) => p.name === u.staying_at) && <option value={u.staying_at}>{u.staying_at} (not in list)</option>}
            </select>
            {places.length === 0 && <p className="mt-1 text-xs text-muted">Add places in the Places tab first.</p>}
          </div>

          <div>
            <div className="zc-label">Phone</div>
            <input
              type="tel"
              className="zc-input"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={savePhone}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
              placeholder="e.g. +263 77 123 4567"
            />
            <p className="mt-1 text-xs text-muted">Only admins can see phone numbers.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {!isSelf && <SmallBtn onClick={() => run(() => actions.setAdmin(u.id, !u.is_admin))}>{u.is_admin ? "Revoke admin" : "Make admin"}</SmallBtn>}
            {!isSelf && <SmallBtn onClick={() => { if (confirm(`${u.claimed ? "Reset the PIN and revoke every session for" : "Generate a new invite code for"} ${u.name}?`)) run(() => actions.adminResetPin(u.id), { onSuccess: (r) => { if (r.ok) setClaimCode(r.claimCode); } }); }}>{u.claimed ? "Reset PIN" : "New invite code"}</SmallBtn>}
            {!isSelf && <SmallBtn tone="danger" onClick={() => { if (confirm(`Remove ${u.name} from the family? This can't be undone.`)) run(() => actions.adminRemovePerson(u.id)); }}>Remove</SmallBtn>}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- nudge unclaimed
/** Lists people who haven't claimed their identity yet, with a copyable invite. */
export function NudgeUnclaimed({ roster }: { roster: RosterUser[] }) {
  const pending = roster.filter((u) => !u.claimed);

  if (pending.length === 0) {
    return <div className="zc-card px-4 py-3 text-sm font-semibold text-muted">Everyone has claimed their identity 🎉</div>;
  }

  return (
    <div className="zc-card overflow-hidden p-0">
      {pending.map((u) => (
        <div key={u.id} className="flex items-center gap-3 border-b border-line2 px-4 py-3 last:border-0">
          <span className="text-xl" aria-hidden>{u.emoji}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-extrabold">{u.name}</div>
            <div className="mono text-[11px] text-muted">@{u.username} · not claimed</div>
          </div>
          <span className="text-right text-[11px] font-semibold text-muted">Use “New invite code”<br />under People</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- bulk locations
/** Assign one place to several people at once. */
export function BulkLocation({ roster, places }: { roster: RosterUser[]; places: Place[] }) {
  const { run, pending } = useAction();
  const [place, setPlace] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const apply = () => {
    if (!place || picked.size === 0) return;
    run(async () => {
      for (const id of picked) await actions.adminSetLocation(id, place);
      return { ok: true as const, message: `Set ${picked.size} ${picked.size === 1 ? "person" : "people"} at ${place}` };
    }, { onSuccess: () => setPicked(new Set()) });
  };

  if (places.length === 0) {
    return <div className="zc-card px-4 py-3 text-sm font-semibold text-muted">Add places first, then you can assign people in bulk.</div>;
  }

  return (
    <div className="zc-card p-4">
      <label className="zc-label">Place</label>
      <select className="zc-input" value={place} onChange={(e) => setPlace(e.target.value)}>
        <option value="">— choose a place —</option>
        {places.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
      </select>
      <div className="zc-label mt-3">People</div>
      <div className="flex flex-wrap gap-1.5">
        {roster.map((u) => {
          const on = picked.has(u.id);
          return (
            <button
              key={u.id}
              onClick={() => toggle(u.id)}
              className={cn("flex items-center gap-1.5 rounded-full border-[1.5px] px-2.5 py-1 text-xs font-bold", on ? "border-honey bg-[color-mix(in_srgb,var(--honey)_15%,transparent)] text-honey" : "border-line bg-card text-ink2")}
            >
              <span className="text-sm" aria-hidden>{u.emoji}</span>
              {u.name}
            </button>
          );
        })}
      </div>
      <button
        onClick={apply}
        disabled={pending || !place || picked.size === 0}
        className="zc-btn mt-4 w-full py-2.5 text-sm disabled:opacity-50"
      >
        {pending && <Spinner />}
        {pending ? "Setting…" : picked.size > 0 && place ? `Set ${picked.size} at ${place}` : "Set location for selected"}
      </button>
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
              <a
                href={mapsUrl(p.name, p.address)}
                target="_blank"
                rel="noreferrer"
                className="whitespace-nowrap rounded-[10px] border border-line px-3 py-1.5 text-xs font-extrabold text-ink2"
              >
                Map ↗
              </a>
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
    scheduled_departure: isoToAirportInput(leg.scheduled_departure, leg.origin_airport),
    scheduled_arrival: isoToAirportInput(leg.scheduled_arrival, leg.destination_airport),
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
          scheduled_departure: airportInputToIso(f.scheduled_departure, f.origin_airport),
          scheduled_arrival: airportInputToIso(f.scheduled_arrival, f.destination_airport),
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
        <button className="zc-btn flex-1 py-2.5 text-sm" disabled={pending}>{pending && <Spinner />}{pending ? "Saving…" : "Save flight"}</button>
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
