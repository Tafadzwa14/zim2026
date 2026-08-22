import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminSupabase } from "@/lib/supabase/admin";
import { PENDING_PIN } from "@/lib/identity";
import type {
  Announcement,
  AppSettings,
  FlightLeg,
  FlightStatus,
  ImportantInfo,
  Photo,
  Pickup,
  Place,
  Plan,
  Poll,
  PollOption,
  PollVote,
  PublicUser,
  ShoppingItem,
  Task,
  TravelGroup,
} from "@/lib/types";
import type {
  AnnouncementView,
  ClaimResult,
  InfoGroup,
  NewAnnouncementInput,
  NewInfoInput,
  NewPhotoInput,
  NewPlaceInput,
  NewPlanInput,
  NewPollInput,
  NewShoppingInput,
  NewTaskInput,
  NewTravelInput,
  NewUserInput,
  PhotoView,
  PlanView,
  PollView,
  Repo,
  RosterUser,
  ShoppingView,
  TaskView,
  TravelView,
} from "./types";

const USER_COLS = "id,name,username,emoji,is_admin,status,roles,staying_at,pin_reset_requested,prefs,created_at,updated_at";

/** Storage bucket holding the shared family photos (see 0006_photos.sql). */
const PHOTO_BUCKET = "photos";

/** Best-effort file extension for a stored object, from name then MIME type. */
function photoExt(fileName: string, contentType: string): string {
  const m = fileName.match(/\.[a-z0-9]+$/i);
  if (m) return m[0].toLowerCase();
  const byMime: Record<string, string> = {
    "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
    "image/gif": ".gif", "image/heic": ".heic", "image/heif": ".heif", "image/avif": ".avif",
  };
  return byMime[contentType] ?? "";
}

function throwIfDbError(error: { message?: string } | null | undefined, fallback: string) {
  if (error) throw new Error(error.message || fallback);
}

function requireRow<T>(data: T | null | undefined, error: { message?: string } | null | undefined, fallback: string): T {
  throwIfDbError(error, fallback);
  if (!data) throw new Error(fallback);
  return data;
}

class SupabaseRepo implements Repo {
  readonly kind = "supabase" as const;
  private sb: SupabaseClient;
  constructor() {
    this.sb = createAdminSupabase();
  }

  private async userMap(): Promise<Map<string, PublicUser>> {
    const { data } = await this.sb.from("users").select(USER_COLS);
    const m = new Map<string, PublicUser>();
    (data ?? []).forEach((u) => m.set((u as PublicUser).id, u as PublicUser));
    return m;
  }

  async getSettings(): Promise<AppSettings> {
    const { data } = await this.sb.from("app_settings").select("*").limit(1).single();
    return (data as AppSettings) ?? { id: "singleton", app_title: "Zim 2026", wedding_date: "2026-09-12", wedding_url: "https://becoming.thechiris.com", updated_at: new Date().toISOString() };
  }
  async updateSettings(patch: Partial<AppSettings>) {
    await this.sb.from("app_settings").update(patch).eq("id", true);
  }

  async listUsers() {
    const { data } = await this.sb.from("users").select(USER_COLS).order("name");
    return (data ?? []) as PublicUser[];
  }
  async getUser(id: string) {
    const { data } = await this.sb.from("users").select(USER_COLS).eq("id", id).maybeSingle();
    return (data as PublicUser) ?? null;
  }
  async getUserWithPin(username: string) {
    const { data } = await this.sb.from("users").select("id,pin_hash").ilike("username", username).maybeSingle();
    return (data as { id: string; pin_hash: string }) ?? null;
  }
  async usernameTaken(username: string) {
    const { data } = await this.sb.from("users").select("id").ilike("username", username).maybeSingle();
    return Boolean(data);
  }
  async createUser(input: NewUserInput) {
    const { data, error } = await this.sb
      .from("users")
      .insert({ name: input.name, username: input.username, emoji: input.emoji, pin_hash: input.pinHash, is_admin: input.is_admin ?? false, status: input.status ?? "here" })
      .select(USER_COLS)
      .single();
    if (error) throw error;
    return data as PublicUser;
  }
  async listPending() {
    const { data } = await this.sb.from("users").select(USER_COLS).eq("pin_hash", PENDING_PIN).order("name");
    return (data ?? []) as PublicUser[];
  }
  async claimUser(id: string, patch: { emoji: string; pinHash: string }) {
    // The pin_hash guard makes this a no-op if the identity was already claimed.
    const { data, error } = await this.sb
      .from("users")
      .update({ emoji: patch.emoji, pin_hash: patch.pinHash })
      .eq("id", id)
      .eq("pin_hash", PENDING_PIN)
      .select(USER_COLS)
      .maybeSingle();
    if (error) throw error;
    return (data as PublicUser) ?? null;
  }
  async listRoster(): Promise<RosterUser[]> {
    const { data } = await this.sb.from("users").select(`${USER_COLS},pin_hash,phone_number`).order("name");
    return ((data ?? []) as (PublicUser & { pin_hash: string; phone_number: string | null })[]).map(
      ({ pin_hash, phone_number, ...rest }) => ({
        ...(rest as PublicUser),
        claimed: pin_hash.includes(":"),
        phone_number: phone_number ?? null,
      }),
    );
  }
  async resetUserPin(id: string) {
    await this.sb.from("users").update({ pin_hash: PENDING_PIN, pin_reset_requested: false }).eq("id", id);
  }
  async requestPinReset(username: string) {
    const { data } = await this.sb.from("users").update({ pin_reset_requested: true }).ilike("username", username).select("id");
    return Boolean(data && data.length);
  }
  async setUserRoles(id: string, roles: string[]) {
    await this.sb.from("users").update({ roles }).eq("id", id);
  }
  async setUserLocation(id: string, stayingAt: string | null) {
    await this.sb.from("users").update({ staying_at: stayingAt }).eq("id", id);
  }
  async listPhoneNumbers(): Promise<Record<string, string | null>> {
    const { data } = await this.sb.from("users").select("id,phone_number");
    const out: Record<string, string | null> = {};
    ((data ?? []) as { id: string; phone_number: string | null }[]).forEach((u) => (out[u.id] = u.phone_number ?? null));
    return out;
  }
  async setUserPhone(id: string, phone: string | null) {
    await this.sb.from("users").update({ phone_number: phone }).eq("id", id);
  }
  async setUserPrefs(id: string, prefs: import("@/lib/types").UserPrefs) {
    await this.sb.from("users").update({ prefs }).eq("id", id);
  }
  async deleteUser(id: string) {
    await this.sb.from("users").delete().eq("id", id);
  }
  async listPlaces() {
    const { data } = await this.sb.from("places").select("*").order("sort_order").order("name");
    return (data ?? []) as Place[];
  }
  async createPlace(input: NewPlaceInput) {
    const { data, error } = await this.sb
      .from("places")
      .insert({ name: input.name, address: input.address ?? null, notes: input.notes ?? null, created_by: input.created_by })
      .select("*")
      .single();
    if (error) throw error;
    return data as Place;
  }
  async updatePlace(id: string, patch: Partial<Pick<Place, "name" | "address" | "notes" | "sort_order">>) {
    await this.sb.from("places").update(patch).eq("id", id);
  }
  async deletePlace(id: string) {
    await this.sb.from("places").delete().eq("id", id);
  }
  async setAdmin(id: string, isAdmin: boolean) {
    await this.sb.from("users").update({ is_admin: isAdmin }).eq("id", id);
  }
  async setUserStatus(id: string, status: PublicUser["status"]) {
    await this.sb.from("users").update({ status }).eq("id", id);
  }

  private planViews(plans: Plan[], attendees: { plan_id: string; user_id: string }[], users: Map<string, PublicUser>): PlanView[] {
    return plans.map((p) => ({
      ...p,
      creator: users.get(p.created_by) ?? null,
      attendees: attendees.filter((a) => a.plan_id === p.id).map((a) => users.get(a.user_id)).filter(Boolean) as PublicUser[],
    }));
  }
  async listPlans() {
    const [{ data: plans }, { data: att }, users] = await Promise.all([
      this.sb.from("plans").select("*").order("date").order("start_time", { nullsFirst: true }),
      this.sb.from("plan_attendees").select("plan_id,user_id"),
      this.userMap(),
    ]);
    return this.planViews((plans ?? []) as Plan[], (att ?? []) as { plan_id: string; user_id: string }[], users);
  }
  async getPlan(id: string) {
    const [{ data: p }, { data: att }, users] = await Promise.all([
      this.sb.from("plans").select("*").eq("id", id).maybeSingle(),
      this.sb.from("plan_attendees").select("plan_id,user_id").eq("plan_id", id),
      this.userMap(),
    ]);
    if (!p) return null;
    return this.planViews([p as Plan], (att ?? []) as { plan_id: string; user_id: string }[], users)[0];
  }
  async createPlan(input: NewPlanInput) {
    const { data: p, error } = await this.sb.from("plans").insert({
      title: input.title, description: input.description ?? null, category: input.category, date: input.date,
      start_time: input.start_time ?? null, location: input.location ?? null, anyone_can_join: input.anyone_can_join, created_by: input.created_by,
    }).select("*").single();
    if (error) throw error;
    const rows = [...new Set(input.attendees)].map((u) => ({ plan_id: (p as Plan).id, user_id: u, added_by: input.created_by }));
    if (rows.length) {
      const { error: attendeeError } = await this.sb.from("plan_attendees").insert(rows);
      throwIfDbError(attendeeError, "Plan attendees were not saved");
    }
    return (await this.getPlan((p as Plan).id))!;
  }
  async deletePlan(id: string) {
    await this.sb.from("plans").delete().eq("id", id);
  }
  async joinPlan(planId: string, userId: string, addedBy: string) {
    await this.sb.from("plan_attendees").upsert({ plan_id: planId, user_id: userId, added_by: addedBy }, { onConflict: "plan_id,user_id", ignoreDuplicates: true });
  }
  async leavePlan(planId: string, userId: string) {
    await this.sb.from("plan_attendees").delete().eq("plan_id", planId).eq("user_id", userId);
  }

  private buildTravel(tg: TravelGroup, legs: FlightLeg[], members: { travel_group_id: string; user_id: string }[], pickups: Pickup[], users: Map<string, PublicUser>): TravelView {
    const myLegs = legs.filter((l) => l.travel_group_id === tg.id).sort((a, b) => a.leg_order - b.leg_order);
    const active = myLegs.find((l) => l.status === "air") ?? myLegs[myLegs.length - 1] ?? null;
    const last = myLegs[myLegs.length - 1] ?? null;
    const pickup = pickups.find((p) => p.travel_group_id === tg.id) ?? null;
    return {
      ...tg,
      members: members.filter((m) => m.travel_group_id === tg.id).map((m) => users.get(m.user_id)).filter(Boolean) as PublicUser[],
      legs: myLegs,
      pickup,
      driver: pickup?.driver_user_id ? users.get(pickup.driver_user_id) ?? null : null,
      activeLeg: active,
      arrivalIso: last?.estimated_arrival ?? last?.scheduled_arrival ?? null,
    };
  }
  private async travelBundle() {
    const [{ data: tg }, { data: legs }, { data: members }, { data: pickups }, users] = await Promise.all([
      this.sb.from("travel_groups").select("*"),
      this.sb.from("flight_legs").select("*"),
      this.sb.from("travel_group_members").select("travel_group_id,user_id"),
      this.sb.from("pickups").select("*"),
      this.userMap(),
    ]);
    return {
      tg: (tg ?? []) as TravelGroup[], legs: (legs ?? []) as FlightLeg[],
      members: (members ?? []) as { travel_group_id: string; user_id: string }[],
      pickups: (pickups ?? []) as Pickup[], users,
    };
  }
  async listTravel() {
    const b = await this.travelBundle();
    return b.tg.map((t) => this.buildTravel(t, b.legs, b.members, b.pickups, b.users)).sort((a, b2) => (a.arrivalIso ?? "").localeCompare(b2.arrivalIso ?? ""));
  }
  async getTravel(id: string) {
    const b = await this.travelBundle();
    const t = b.tg.find((x) => x.id === id);
    return t ? this.buildTravel(t, b.legs, b.members, b.pickups, b.users) : null;
  }
  async createTravel(input: NewTravelInput) {
    const { data: tg, error } = await this.sb.from("travel_groups").insert({ title: input.title, status: "upcoming", general_notes: input.notes ?? null, created_by: input.created_by }).select("*").single();
    if (error) throw error;
    const gid = (tg as TravelGroup).id;
    if (input.travellers.length) {
      const { error: membersError } = await this.sb.from("travel_group_members").insert(input.travellers.map((u) => ({ travel_group_id: gid, user_id: u })));
      throwIfDbError(membersError, "Travellers were not saved");
    }
    let firstLeg: string | null = null;
    for (const l of input.legs) {
      const { data: leg, error: legError } = await this.sb.from("flight_legs").insert({
        travel_group_id: gid, leg_order: l.leg_order, provider: l.provider ?? "demo", provider_flight_id: l.provider_flight_id ?? null,
        flight_number: l.flight_number, airline_code: l.airline_code ?? null, airline_name: l.airline_name ?? null,
        origin_airport: l.origin_airport, origin_city: l.origin_city ?? null, destination_airport: l.destination_airport, destination_city: l.destination_city ?? null,
        scheduled_departure: l.scheduled_departure ?? null, scheduled_arrival: l.scheduled_arrival ?? null, estimated_arrival: l.estimated_arrival ?? null,
        terminal_departure: l.terminal_departure ?? null, aircraft_type: l.aircraft_type ?? null, aircraft_type_code: l.aircraft_type_code ?? null,
        aircraft_registration: l.aircraft_registration ?? null, status: l.status ?? "scheduled",
      }).select("id").single();
      firstLeg ??= requireRow(leg as { id: string } | null, legError, "Flight leg was not saved").id;
    }
    if (input.pickup) {
      const { error: pickupError } = await this.sb.from("pickups").insert({ travel_group_id: gid, flight_leg_id: firstLeg, requested: true });
      throwIfDbError(pickupError, "Pickup request was not saved");
    }
    return (await this.getTravel(gid))!;
  }
  async setTravelStatus(id: string, status: TravelGroup["status"]) {
    await this.sb.from("travel_groups").update({ status }).eq("id", id);
  }
  async setLegStatus(legId: string, status: FlightStatus, progress: number | null) {
    await this.sb.from("flight_legs").update({ status, ...(progress != null ? { progress } : {}) }).eq("id", legId);
  }
  async syncLeg(legId: string, patch: Partial<FlightLeg>) {
    await this.sb.from("flight_legs").update({ ...patch, last_synced_at: new Date().toISOString() }).eq("id", legId);
  }

  async requestPickup(travelGroupId: string, flightLegId: string | null) {
    await this.sb.from("pickups").upsert({ travel_group_id: travelGroupId, flight_leg_id: flightLegId, requested: true }, { onConflict: "travel_group_id" });
  }
  async claimPickup(travelGroupId: string, userId: string): Promise<ClaimResult> {
    const { data } = await this.sb.from("pickups").update({ driver_user_id: userId }).eq("travel_group_id", travelGroupId).is("driver_user_id", null).select("driver_user_id");
    if (data && data.length) return { ok: true };
    const { data: cur } = await this.sb.from("pickups").select("driver_user_id").eq("travel_group_id", travelGroupId).maybeSingle();
    return { ok: false, claimedBy: (cur as { driver_user_id: string | null } | null)?.driver_user_id ?? null };
  }
  async assignPickup(travelGroupId: string, driverUserId: string) {
    await this.sb.from("pickups").update({ driver_user_id: driverUserId, driver_en_route: false }).eq("travel_group_id", travelGroupId);
  }
  async releasePickup(travelGroupId: string) {
    await this.sb.from("pickups").update({ driver_user_id: null, driver_en_route: false }).eq("travel_group_id", travelGroupId);
  }
  async setPickupEnRoute(travelGroupId: string, enRoute: boolean) {
    await this.sb.from("pickups").update({ driver_en_route: enRoute }).eq("travel_group_id", travelGroupId);
  }

  async listShopping(): Promise<ShoppingView[]> {
    const [{ data }, users] = await Promise.all([this.sb.from("shopping_items").select("*").order("created_at"), this.userMap()]);
    return ((data ?? []) as ShoppingItem[]).map((s) => ({ ...s, creator: users.get(s.created_by ?? "") ?? null, claimer: s.claimed_by ? users.get(s.claimed_by) ?? null : null }));
  }
  async addShopping(input: NewShoppingInput) {
    const { data, error } = await this.sb.from("shopping_items").insert({ item: input.item, quantity: input.quantity, category: input.category, notes: input.notes ?? null, created_by: input.created_by, claimed_by: input.claimed_by ?? null }).select("*").single();
    const s = requireRow(data as ShoppingItem | null, error, "Shopping item was not saved");
    const users = await this.userMap();
    return { ...s, creator: users.get(s.created_by ?? "") ?? null, claimer: null };
  }
  async setShoppingQuantity(id: string, quantity: number) {
    await this.sb.from("shopping_items").update({ quantity: Math.max(1, Math.floor(quantity)) }).eq("id", id);
  }
  async assignShopping(id: string, userId: string | null) {
    await this.sb.from("shopping_items").update({ claimed_by: userId }).eq("id", id);
  }
  async claimShopping(id: string, userId: string): Promise<ClaimResult> {
    const { data } = await this.sb.from("shopping_items").update({ claimed_by: userId }).eq("id", id).is("claimed_by", null).select("claimed_by");
    if (data && data.length) return { ok: true };
    const { data: cur } = await this.sb.from("shopping_items").select("claimed_by").eq("id", id).maybeSingle();
    return { ok: false, claimedBy: (cur as { claimed_by: string | null } | null)?.claimed_by ?? null };
  }
  async unclaimShopping(id: string) {
    await this.sb.from("shopping_items").update({ claimed_by: null }).eq("id", id);
  }
  async setShoppingDone(id: string, done: boolean, userId: string) {
    const patch: Record<string, unknown> = { completed: done, completed_at: done ? new Date().toISOString() : null };
    if (done) {
      const { data: cur } = await this.sb.from("shopping_items").select("claimed_by").eq("id", id).maybeSingle();
      if (!(cur as { claimed_by: string | null } | null)?.claimed_by) patch.claimed_by = userId;
    }
    await this.sb.from("shopping_items").update(patch).eq("id", id);
  }

  async listTasks(): Promise<TaskView[]> {
    const [{ data }, users] = await Promise.all([this.sb.from("tasks").select("*").order("created_at"), this.userMap()]);
    return ((data ?? []) as Task[]).map((t) => ({ ...t, creator: users.get(t.created_by ?? "") ?? null, assignee: t.assigned_to ? users.get(t.assigned_to) ?? null : null }));
  }
  async addTask(input: NewTaskInput) {
    const { data, error } = await this.sb.from("tasks").insert({ title: input.title, notes: input.notes ?? null, due_date: input.due_date ?? null, created_by: input.created_by }).select("*").single();
    const t = requireRow(data as Task | null, error, "Task was not saved");
    const users = await this.userMap();
    return { ...t, creator: users.get(t.created_by ?? "") ?? null, assignee: null };
  }
  async updateTask(id: string, patch: Partial<Pick<Task, "title" | "notes" | "due_date">>) {
    await this.sb.from("tasks").update(patch).eq("id", id);
  }
  async claimTask(id: string, userId: string): Promise<ClaimResult> {
    const { data } = await this.sb.from("tasks").update({ assigned_to: userId }).eq("id", id).is("assigned_to", null).select("assigned_to");
    if (data && data.length) return { ok: true };
    const { data: cur } = await this.sb.from("tasks").select("assigned_to").eq("id", id).maybeSingle();
    return { ok: false, claimedBy: (cur as { assigned_to: string | null } | null)?.assigned_to ?? null };
  }
  async unclaimTask(id: string) {
    await this.sb.from("tasks").update({ assigned_to: null }).eq("id", id);
  }
  async setTaskDone(id: string, done: boolean, userId: string) {
    const patch: Record<string, unknown> = { completed: done, completed_at: done ? new Date().toISOString() : null };
    if (done) {
      const { data: cur } = await this.sb.from("tasks").select("assigned_to").eq("id", id).maybeSingle();
      if (!(cur as { assigned_to: string | null } | null)?.assigned_to) patch.assigned_to = userId;
    }
    await this.sb.from("tasks").update(patch).eq("id", id);
  }
  async deleteTask(id: string) {
    await this.sb.from("tasks").delete().eq("id", id);
  }

  async listInfo(): Promise<InfoGroup[]> {
    const { data } = await this.sb.from("important_info").select("*").order("sort_order");
    const groups: InfoGroup[] = [];
    for (const item of (data ?? []) as ImportantInfo[]) {
      let g = groups.find((x) => x.category === item.category);
      if (!g) { g = { category: item.category, items: [] }; groups.push(g); }
      g.items.push(item);
    }
    return groups;
  }
  async addInfo(input: NewInfoInput) {
    const { data: rows } = await this.sb.from("important_info").select("sort_order").eq("category", input.category).order("sort_order", { ascending: false }).limit(1);
    const next = ((rows?.[0] as { sort_order: number } | undefined)?.sort_order ?? -1) + 1;
    await this.sb.from("important_info").insert({
      category: input.category, title: input.title, content: input.content,
      sort_order: next, created_by: input.created_by, updated_by: input.created_by,
    });
  }
  async updateInfo(id: string, patch: Partial<Pick<ImportantInfo, "category" | "title" | "content" | "sort_order">>, updatedBy: string) {
    await this.sb.from("important_info").update({ ...patch, updated_by: updatedBy }).eq("id", id);
  }
  async deleteInfo(id: string) {
    await this.sb.from("important_info").delete().eq("id", id);
  }
  async listAnnouncements(): Promise<AnnouncementView[]> {
    const [{ data }, users] = await Promise.all([this.sb.from("announcements").select("*").order("is_pinned", { ascending: false }).order("created_at", { ascending: false }), this.userMap()]);
    return ((data ?? []) as Announcement[]).map((a) => ({ ...a, creator: a.created_by ? users.get(a.created_by) ?? null : null }));
  }
  async addAnnouncement(input: NewAnnouncementInput) {
    if (input.is_pinned) {
      const { error } = await this.sb.from("announcements").update({ is_pinned: false }).eq("is_pinned", true);
      throwIfDbError(error, "Existing announcements could not be unpinned");
    }
    const { error } = await this.sb.from("announcements").insert({ title: input.title, content: input.content ?? null, is_pinned: input.is_pinned, expires_at: input.expires_at ?? null, created_by: input.created_by });
    throwIfDbError(error, "Announcement was not saved");
  }
  async setAnnouncementPinned(id: string, pinned: boolean) {
    if (pinned) await this.sb.from("announcements").update({ is_pinned: false }).eq("is_pinned", true);
    await this.sb.from("announcements").update({ is_pinned: pinned }).eq("id", id);
  }
  async deleteAnnouncement(id: string) {
    await this.sb.from("announcements").delete().eq("id", id);
  }
  async listActivity(limit = 40) {
    const [{ data }, users] = await Promise.all([this.sb.from("activity").select("*").order("created_at", { ascending: false }).limit(limit), this.userMap()]);
    return ((data ?? []) as import("@/lib/types").Activity[]).map((a) => ({ ...a, actor: a.actor_user_id ? users.get(a.actor_user_id) ?? null : null }));
  }
  async addActivity(actorId: string, type: string, text: string, entity?: { type: string; id: string }) {
    const { error } = await this.sb.from("activity").insert({ actor_user_id: actorId, type, entity_type: entity?.type ?? null, entity_id: entity?.id ?? null, metadata: { text } });
    throwIfDbError(error, "Activity was not saved");
  }

  async listPolls(userId: string): Promise<PollView[]> {
    const [{ data: polls }, { data: options }, { data: votes }, users] = await Promise.all([
      this.sb.from("polls").select("*").order("closed").order("created_at", { ascending: false }),
      this.sb.from("poll_options").select("*").order("sort_order"),
      this.sb.from("poll_votes").select("poll_id,option_id,user_id"),
      this.userMap(),
    ]);
    const opts = (options ?? []) as PollOption[];
    const vts = (votes ?? []) as Pick<PollVote, "poll_id" | "option_id" | "user_id">[];
    return ((polls ?? []) as Poll[]).map((p) => {
      const myVote = vts.find((v) => v.poll_id === p.id && v.user_id === userId) ?? null;
      const pollVotes = vts.filter((v) => v.poll_id === p.id);
      return {
        ...p,
        options: opts.filter((o) => o.poll_id === p.id).map((o) => ({ ...o, votes: pollVotes.filter((v) => v.option_id === o.id).length })),
        total: pollVotes.length,
        myOptionId: myVote?.option_id ?? null,
        creator: p.created_by ? users.get(p.created_by) ?? null : null,
      };
    });
  }
  async createPoll(input: NewPollInput): Promise<PollView> {
    const { data: p, error } = await this.sb.from("polls").insert({ question: input.question, created_by: input.created_by }).select("*").single();
    if (error) throw error;
    const poll = p as Poll;
    const rows = input.options.map((label, i) => ({ poll_id: poll.id, label, sort_order: i }));
    if (rows.length) await this.sb.from("poll_options").insert(rows);
    return (await this.listPolls(input.created_by)).find((x) => x.id === poll.id)!;
  }
  async votePoll(pollId: string, optionId: string, userId: string) {
    await this.sb.from("poll_votes").upsert({ poll_id: pollId, option_id: optionId, user_id: userId }, { onConflict: "poll_id,user_id" });
  }
  async setPollClosed(id: string, closed: boolean) {
    await this.sb.from("polls").update({ closed }).eq("id", id);
  }
  async deletePoll(id: string) {
    await this.sb.from("polls").delete().eq("id", id);
  }

  private photoView(p: Photo, users: Map<string, PublicUser>): PhotoView {
    const { data } = this.sb.storage.from(PHOTO_BUCKET).getPublicUrl(p.storage_path);
    return { ...p, url: data.publicUrl, uploader: p.uploaded_by ? users.get(p.uploaded_by) ?? null : null };
  }
  async listPhotos(): Promise<PhotoView[]> {
    const [{ data }, users] = await Promise.all([
      this.sb.from("photos").select("*").order("created_at", { ascending: false }),
      this.userMap(),
    ]);
    return ((data ?? []) as Photo[]).map((p) => this.photoView(p, users));
  }
  async addPhoto(input: NewPhotoInput): Promise<PhotoView> {
    const path = `${globalThis.crypto.randomUUID()}${photoExt(input.fileName, input.contentType)}`;
    const { error: upErr } = await this.sb.storage
      .from(PHOTO_BUCKET)
      .upload(path, input.bytes, { contentType: input.contentType, upsert: false });
    if (upErr) throw upErr;
    const { data, error } = await this.sb
      .from("photos")
      .insert({ storage_path: path, caption: input.caption ?? null, content_type: input.contentType, size_bytes: input.size, uploaded_by: input.uploaded_by })
      .select("*")
      .single();
    if (error) {
      // Roll back the orphaned object if the metadata insert failed.
      await this.sb.storage.from(PHOTO_BUCKET).remove([path]);
      throw error;
    }
    return this.photoView(data as Photo, await this.userMap());
  }
  async updatePhotoCaption(id: string, caption: string | null) {
    await this.sb.from("photos").update({ caption }).eq("id", id);
  }
  async deletePhoto(id: string) {
    const { data } = await this.sb.from("photos").select("storage_path").eq("id", id).maybeSingle();
    const path = (data as { storage_path: string } | null)?.storage_path;
    if (path) await this.sb.storage.from(PHOTO_BUCKET).remove([path]);
    await this.sb.from("photos").delete().eq("id", id);
  }
}

let instance: SupabaseRepo | null = null;
export function getSupabaseRepo(): Repo {
  instance ??= new SupabaseRepo();
  return instance;
}
