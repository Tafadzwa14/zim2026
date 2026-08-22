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
  const safe = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".heic", ".heif", ".avif"]);
  if (m && safe.has(m[0].toLowerCase())) return m[0].toLowerCase();
  const byMime: Record<string, string> = {
    "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
    "image/gif": ".gif", "image/heic": ".heic", "image/heif": ".heif", "image/avif": ".avif",
  };
  return byMime[contentType] ?? "";
}

function throwIfDbError(error: { message?: string } | null | undefined, fallback: string) {
  if (error) {
    console.error(`[SupabaseRepo] ${fallback}:`, error.message ?? error);
    throw new Error(fallback);
  }
}

function requireRow<T>(data: T | null | undefined, error: { message?: string } | null | undefined, fallback: string): T {
  throwIfDbError(error, fallback);
  if (!data) throw new Error(fallback);
  return data;
}

function missingSecurityMigration(error: { code?: string; message?: string } | null | undefined): boolean {
  return Boolean(
    error &&
    (error.code === "42703" || error.code === "42883" || error.code === "PGRST202" ||
      error.message?.includes("session_version") || error.message?.includes("consume_auth_attempt")),
  );
}

class SupabaseRepo implements Repo {
  readonly kind = "supabase" as const;
  private sb: SupabaseClient;
  /** Temporary process-local protection while a deployment is awaiting 0009. */
  private legacyAuthAttempts = new Map<string, { attempts: number; startedAt: number; blockedUntil: number }>();
  constructor() {
    this.sb = createAdminSupabase();
  }

  private async userMap(): Promise<Map<string, PublicUser>> {
    const { data, error } = await this.sb.from("users").select(USER_COLS);
    throwIfDbError(error, "People could not be loaded");
    const m = new Map<string, PublicUser>();
    (data ?? []).forEach((u) => m.set((u as PublicUser).id, u as PublicUser));
    return m;
  }

  async getSettings(): Promise<AppSettings> {
    const { data, error } = await this.sb.from("app_settings").select("*").limit(1).single();
    throwIfDbError(error, "Settings could not be loaded");
    return (data as AppSettings) ?? { id: true, app_title: "Zim 2026", wedding_date: "2026-09-12", wedding_url: "https://becoming.thechiris.com", updated_at: new Date().toISOString() };
  }
  async updateSettings(patch: Partial<AppSettings>) {
    const { error } = await this.sb.from("app_settings").update(patch).eq("id", true);
    throwIfDbError(error, "Settings were not saved");
  }

  async listUsers() {
    const { data, error } = await this.sb.from("users").select(USER_COLS).order("name");
    throwIfDbError(error, "People could not be loaded");
    return (data ?? []) as PublicUser[];
  }
  async getUser(id: string) {
    const { data, error } = await this.sb.from("users").select(USER_COLS).eq("id", id).maybeSingle();
    throwIfDbError(error, "Person could not be loaded");
    return (data as PublicUser) ?? null;
  }
  async getUserWithPin(id: string) {
    const { data, error } = await this.sb.from("users").select("id,pin_hash,session_version").eq("id", id).maybeSingle();
    if (missingSecurityMigration(error)) {
      const legacy = await this.sb.from("users").select("id,pin_hash").eq("id", id).maybeSingle();
      throwIfDbError(legacy.error, "Identity could not be read");
      const row = legacy.data as { id: string; pin_hash: string } | null;
      return row ? { ...row, session_version: 0 } : null;
    }
    throwIfDbError(error, "Identity could not be read");
    return (data as { id: string; pin_hash: string; session_version: number }) ?? null;
  }
  async getSessionVersion(id: string) {
    const { data, error } = await this.sb.from("users").select("session_version").eq("id", id).maybeSingle();
    if (missingSecurityMigration(error)) {
      const legacy = await this.sb.from("users").select("id").eq("id", id).maybeSingle();
      throwIfDbError(legacy.error, "Session could not be checked");
      return legacy.data ? 0 : null;
    }
    throwIfDbError(error, "Session could not be checked");
    return (data as { session_version: number } | null)?.session_version ?? null;
  }
  async usernameTaken(username: string) {
    const { data, error } = await this.sb.from("users").select("id").eq("username_normalized", username.toLowerCase()).maybeSingle();
    throwIfDbError(error, "Username could not be checked");
    return Boolean(data);
  }
  async createUser(input: NewUserInput) {
    const { data, error } = await this.sb
      .from("users")
      .insert({ name: input.name, username: input.username, emoji: input.emoji, pin_hash: input.pinHash, claim_token_hash: input.claimTokenHash, is_admin: input.is_admin ?? false, status: input.status ?? "here" })
      .select(USER_COLS)
      .single();
    return requireRow(data as PublicUser | null, error, "Person was not created");
  }
  async listPending() {
    const { data, error } = await this.sb.from("users").select(USER_COLS).eq("pin_hash", PENDING_PIN).order("name");
    throwIfDbError(error, "Pending people could not be loaded");
    return (data ?? []) as PublicUser[];
  }
  async claimUser(id: string, patch: { emoji: string; pinHash: string; claimTokenHash: string }) {
    const { data: version, error } = await this.sb.rpc("claim_user", {
      p_user_id: id,
      p_emoji: patch.emoji,
      p_pin_hash: patch.pinHash,
      p_claim_token_hash: patch.claimTokenHash,
    });
    throwIfDbError(error, "Identity could not be claimed");
    if (typeof version !== "number" || version < 0) return null;
    const user = await this.getUser(id);
    return user ? { user, sessionVersion: version } : null;
  }
  async listRoster(): Promise<RosterUser[]> {
    const { data, error } = await this.sb.from("users").select(`${USER_COLS},pin_hash,phone_number`).order("name");
    throwIfDbError(error, "Roster could not be loaded");
    return ((data ?? []) as (PublicUser & { pin_hash: string; phone_number: string | null })[]).map(
      ({ pin_hash, phone_number, ...rest }) => ({
        ...(rest as PublicUser),
        claimed: pin_hash.includes(":"),
        phone_number: phone_number ?? null,
      }),
    );
  }
  async resetUserPin(id: string, claimTokenHash: string) {
    const { error } = await this.sb.rpc("reset_user_pin", { p_user_id: id, p_claim_token_hash: claimTokenHash });
    throwIfDbError(error, "PIN could not be reset");
  }
  async requestPinReset(userId: string) {
    const { data, error } = await this.sb.from("users").update({ pin_reset_requested: true }).eq("id", userId).select("id");
    throwIfDbError(error, "PIN reset could not be requested");
    return Boolean(data && data.length);
  }
  async consumeAuthAttempt(key: string) {
    const { data, error } = await this.sb.rpc("consume_auth_attempt", { p_key: key });
    if (missingSecurityMigration(error)) {
      const now = Date.now();
      const current = this.legacyAuthAttempts.get(key);
      const row = !current || current.startedAt < now - 15 * 60_000
        ? { attempts: 1, startedAt: now, blockedUntil: 0 }
        : { ...current, attempts: current.attempts + 1 };
      if (row.attempts > 5) row.blockedUntil = Math.max(row.blockedUntil, now + 15 * 60_000);
      this.legacyAuthAttempts.set(key, row);
      return row.blockedUntil <= now;
    }
    throwIfDbError(error, "Sign-in rate limit could not be checked");
    return data === true;
  }
  async clearAuthAttempts(key: string) {
    const { error } = await this.sb.rpc("clear_auth_attempts", { p_key: key });
    if (missingSecurityMigration(error)) {
      this.legacyAuthAttempts.delete(key);
      return;
    }
    throwIfDbError(error, "Sign-in rate limit could not be cleared");
  }
  async setUserRoles(id: string, roles: string[]) {
    const { error } = await this.sb.from("users").update({ roles }).eq("id", id);
    throwIfDbError(error, "Roles were not saved");
  }
  async setUserLocation(id: string, stayingAt: string | null) {
    const { error } = await this.sb.from("users").update({ staying_at: stayingAt }).eq("id", id);
    throwIfDbError(error, "Location was not saved");
  }
  async listPhoneNumbers(): Promise<Record<string, string | null>> {
    const { data, error } = await this.sb.from("users").select("id,phone_number");
    throwIfDbError(error, "Phone numbers could not be loaded");
    const out: Record<string, string | null> = {};
    ((data ?? []) as { id: string; phone_number: string | null }[]).forEach((u) => (out[u.id] = u.phone_number ?? null));
    return out;
  }
  async setUserPhone(id: string, phone: string | null) {
    const { error } = await this.sb.from("users").update({ phone_number: phone }).eq("id", id);
    throwIfDbError(error, "Phone number was not saved");
  }
  async setUserPrefs(id: string, prefs: import("@/lib/types").UserPrefs) {
    const { error } = await this.sb.from("users").update({ prefs }).eq("id", id);
    throwIfDbError(error, "Preferences were not saved");
  }
  async deleteUser(id: string) {
    const { error } = await this.sb.from("users").delete().eq("id", id);
    throwIfDbError(error, "Person was not removed");
  }
  async listPlaces() {
    const { data, error } = await this.sb.from("places").select("*").order("sort_order").order("name");
    throwIfDbError(error, "Places could not be loaded");
    return (data ?? []) as Place[];
  }
  async createPlace(input: NewPlaceInput) {
    const { data, error } = await this.sb
      .from("places")
      .insert({ name: input.name, address: input.address ?? null, notes: input.notes ?? null, created_by: input.created_by })
      .select("*")
      .single();
    return requireRow(data as Place | null, error, "Place was not created");
  }
  async updatePlace(id: string, patch: Partial<Pick<Place, "name" | "address" | "notes" | "sort_order">>) {
    const { error } = await this.sb.from("places").update(patch).eq("id", id);
    throwIfDbError(error, "Place was not updated");
  }
  async deletePlace(id: string) {
    const { error } = await this.sb.from("places").delete().eq("id", id);
    throwIfDbError(error, "Place was not removed");
  }
  async setAdmin(id: string, isAdmin: boolean) {
    const { error } = await this.sb.from("users").update({ is_admin: isAdmin }).eq("id", id);
    throwIfDbError(error, "Admin access was not changed");
  }
  async setUserStatus(id: string, status: PublicUser["status"]) {
    const { error } = await this.sb.from("users").update({ status }).eq("id", id);
    throwIfDbError(error, "Travel status was not saved");
  }

  private planViews(plans: Plan[], attendees: { plan_id: string; user_id: string }[], users: Map<string, PublicUser>): PlanView[] {
    return plans.map((p) => ({
      ...p,
      creator: p.created_by ? users.get(p.created_by) ?? null : null,
      attendees: attendees.filter((a) => a.plan_id === p.id).map((a) => users.get(a.user_id)).filter(Boolean) as PublicUser[],
    }));
  }
  async listPlans() {
    const [{ data: plans, error: plansError }, { data: att, error: attendeesError }, users] = await Promise.all([
      this.sb.from("plans").select("*").order("date").order("start_time", { nullsFirst: true }),
      this.sb.from("plan_attendees").select("plan_id,user_id"),
      this.userMap(),
    ]);
    throwIfDbError(plansError, "Plans could not be loaded");
    throwIfDbError(attendeesError, "Plan attendees could not be loaded");
    return this.planViews((plans ?? []) as Plan[], (att ?? []) as { plan_id: string; user_id: string }[], users);
  }
  async getPlan(id: string) {
    const [{ data: p, error: planError }, { data: att, error: attendeesError }, users] = await Promise.all([
      this.sb.from("plans").select("*").eq("id", id).maybeSingle(),
      this.sb.from("plan_attendees").select("plan_id,user_id").eq("plan_id", id),
      this.userMap(),
    ]);
    throwIfDbError(planError, "Plan could not be loaded");
    throwIfDbError(attendeesError, "Plan attendees could not be loaded");
    if (!p) return null;
    return this.planViews([p as Plan], (att ?? []) as { plan_id: string; user_id: string }[], users)[0];
  }
  async createPlan(input: NewPlanInput) {
    const { data: id, error } = await this.sb.rpc("create_plan_atomic", {
      p_plan: input,
      p_attendees: [...new Set(input.attendees)],
    });
    throwIfDbError(error, "Plan was not saved");
    if (typeof id !== "string") throw new Error("Plan was not saved");
    return (await this.getPlan(id))!;
  }
  async deletePlan(id: string) {
    const { error } = await this.sb.from("plans").delete().eq("id", id);
    throwIfDbError(error, "Plan was not deleted");
  }
  async joinPlan(planId: string, userId: string, addedBy: string) {
    const { error } = await this.sb.from("plan_attendees").upsert({ plan_id: planId, user_id: userId, added_by: addedBy }, { onConflict: "plan_id,user_id", ignoreDuplicates: true });
    throwIfDbError(error, "Plan attendee was not added");
  }
  async leavePlan(planId: string, userId: string) {
    const { error } = await this.sb.from("plan_attendees").delete().eq("plan_id", planId).eq("user_id", userId);
    throwIfDbError(error, "Plan attendee was not removed");
  }

  private buildTravel(tg: TravelGroup, legs: FlightLeg[], members: { travel_group_id: string; user_id: string }[], pickups: Pickup[], users: Map<string, PublicUser>): TravelView {
    const myLegs = legs.filter((l) => l.travel_group_id === tg.id).sort((a, b) => a.leg_order - b.leg_order);
    const active = myLegs.find((l) => l.status === "air") ?? myLegs[myLegs.length - 1] ?? null;
    const last = myLegs[myLegs.length - 1] ?? null;
    const groupPickups = pickups.filter((p) => p.travel_group_id === tg.id && p.requested);
    const pickup = groupPickups.find((p) => p.flight_leg_id === last?.id) ?? null;
    return {
      ...tg,
      members: members.filter((m) => m.travel_group_id === tg.id).map((m) => users.get(m.user_id)).filter(Boolean) as PublicUser[],
      legs: myLegs,
      pickup,
      pickups: groupPickups,
      driver: pickup?.driver_user_id ? users.get(pickup.driver_user_id) ?? null : null,
      activeLeg: active,
      arrivalIso: last?.actual_arrival ?? last?.estimated_arrival ?? last?.scheduled_arrival ?? null,
    };
  }
  private async travelBundle() {
    const [groupsResult, legsResult, membersResult, pickupsResult, users] = await Promise.all([
      this.sb.from("travel_groups").select("*"),
      this.sb.from("flight_legs").select("*"),
      this.sb.from("travel_group_members").select("travel_group_id,user_id"),
      this.sb.from("pickups").select("*"),
      this.userMap(),
    ]);
    throwIfDbError(groupsResult.error, "Journeys could not be loaded");
    throwIfDbError(legsResult.error, "Flight legs could not be loaded");
    throwIfDbError(membersResult.error, "Travellers could not be loaded");
    throwIfDbError(pickupsResult.error, "Pickups could not be loaded");
    return {
      tg: (groupsResult.data ?? []) as TravelGroup[], legs: (legsResult.data ?? []) as FlightLeg[],
      members: (membersResult.data ?? []) as { travel_group_id: string; user_id: string }[],
      pickups: (pickupsResult.data ?? []) as Pickup[], users,
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
    const { data: gid, error } = await this.sb.rpc("create_travel_atomic", {
      p_group: { title: input.title, notes: input.notes ?? null, created_by: input.created_by },
      p_travellers: [...new Set(input.travellers)],
      p_legs: input.legs,
      p_pickup: input.pickup,
    });
    throwIfDbError(error, "Travel was not saved");
    if (typeof gid !== "string") throw new Error("Travel was not saved");
    return (await this.getTravel(gid))!;
  }
  async setTravelStatus(id: string, status: TravelGroup["status"]) {
    const { error } = await this.sb.from("travel_groups").update({ status }).eq("id", id);
    throwIfDbError(error, "Journey status was not saved");
  }
  async setLegStatus(legId: string, status: FlightStatus, progress: number | null) {
    const { error } = await this.sb.from("flight_legs").update({ status, ...(progress != null ? { progress } : {}) }).eq("id", legId);
    throwIfDbError(error, "Flight status was not saved");
  }
  async syncLeg(legId: string, patch: Partial<FlightLeg>) {
    const { error } = await this.sb.from("flight_legs").update({ ...patch, last_synced_at: new Date().toISOString() }).eq("id", legId);
    throwIfDbError(error, "Flight was not updated");
  }

  async getPickup(id: string) {
    const { data, error } = await this.sb.from("pickups").select("*").eq("id", id).maybeSingle();
    throwIfDbError(error, "Pickup could not be read");
    return (data as Pickup) ?? null;
  }
  async setPickupRequested(travelGroupId: string, flightLegId: string, requested: boolean) {
    const { error } = await this.sb.from("pickups").upsert({
      travel_group_id: travelGroupId,
      flight_leg_id: flightLegId,
      requested,
      ...(!requested ? { driver_user_id: null, driver_en_route: false } : {}),
    }, { onConflict: "flight_leg_id" });
    throwIfDbError(error, "Pickup preference was not saved");
  }
  async claimPickup(pickupId: string, userId: string): Promise<ClaimResult> {
    const { data, error } = await this.sb.from("pickups").update({ driver_user_id: userId }).eq("id", pickupId).is("driver_user_id", null).select("driver_user_id");
    throwIfDbError(error, "Pickup could not be claimed");
    if (data && data.length) return { ok: true };
    const { data: cur, error: readError } = await this.sb.from("pickups").select("driver_user_id").eq("id", pickupId).maybeSingle();
    throwIfDbError(readError, "Pickup could not be read");
    return { ok: false, claimedBy: (cur as { driver_user_id: string | null } | null)?.driver_user_id ?? null };
  }
  async assignPickup(pickupId: string, driverUserId: string) {
    const { error } = await this.sb.from("pickups").update({ driver_user_id: driverUserId, driver_en_route: false }).eq("id", pickupId);
    throwIfDbError(error, "Pickup was not assigned");
  }
  async releasePickup(pickupId: string) {
    const { error } = await this.sb.from("pickups").update({ driver_user_id: null, driver_en_route: false }).eq("id", pickupId);
    throwIfDbError(error, "Pickup was not released");
  }
  async setPickupEnRoute(pickupId: string, enRoute: boolean) {
    const { error } = await this.sb.from("pickups").update({ driver_en_route: enRoute }).eq("id", pickupId);
    throwIfDbError(error, "Pickup was not updated");
  }

  async listShopping(): Promise<ShoppingView[]> {
    const [{ data, error }, users] = await Promise.all([this.sb.from("shopping_items").select("*").order("created_at"), this.userMap()]);
    throwIfDbError(error, "Shopping list could not be loaded");
    return ((data ?? []) as ShoppingItem[]).map((s) => ({ ...s, creator: users.get(s.created_by ?? "") ?? null, claimer: s.claimed_by ? users.get(s.claimed_by) ?? null : null }));
  }
  async addShopping(input: NewShoppingInput) {
    const { data, error } = await this.sb.from("shopping_items").insert({ item: input.item, quantity: input.quantity, category: input.category, notes: input.notes ?? null, created_by: input.created_by, claimed_by: input.claimed_by ?? null }).select("*").single();
    const s = requireRow(data as ShoppingItem | null, error, "Shopping item was not saved");
    const users = await this.userMap();
    return { ...s, creator: users.get(s.created_by ?? "") ?? null, claimer: null };
  }
  async addOrMergeShopping(input: NewShoppingInput) {
    const { data, error } = await this.sb.rpc("add_shopping_atomic", {
      p_item: input.item, p_quantity: input.quantity, p_category: input.category,
      p_created_by: input.created_by, p_claimed_by: input.claimed_by ?? null,
    });
    throwIfDbError(error, "Shopping item was not saved");
    if (typeof data !== "string") throw new Error("Shopping item was not saved");
    return { id: data };
  }
  async setShoppingQuantity(id: string, quantity: number) {
    const { error } = await this.sb.from("shopping_items").update({ quantity: Math.max(1, Math.floor(quantity)) }).eq("id", id);
    throwIfDbError(error, "Shopping quantity was not updated");
  }
  async assignShopping(id: string, userId: string | null) {
    const { error } = await this.sb.from("shopping_items").update({ claimed_by: userId }).eq("id", id);
    throwIfDbError(error, "Shopping assignment was not updated");
  }
  async claimShopping(id: string, userId: string): Promise<ClaimResult> {
    const { data, error } = await this.sb.from("shopping_items").update({ claimed_by: userId }).eq("id", id).is("claimed_by", null).select("claimed_by");
    throwIfDbError(error, "Shopping item could not be claimed");
    if (data && data.length) return { ok: true };
    const { data: cur, error: readError } = await this.sb.from("shopping_items").select("claimed_by").eq("id", id).maybeSingle();
    throwIfDbError(readError, "Shopping item could not be read");
    return { ok: false, claimedBy: (cur as { claimed_by: string | null } | null)?.claimed_by ?? null };
  }
  async unclaimShopping(id: string) {
    const { error } = await this.sb.from("shopping_items").update({ claimed_by: null }).eq("id", id);
    throwIfDbError(error, "Shopping item was not released");
  }
  async setShoppingDone(id: string, done: boolean, userId: string) {
    const { error } = await this.sb.rpc("set_shopping_done_atomic", { p_id: id, p_done: done, p_user_id: userId });
    throwIfDbError(error, "Shopping item was not updated");
  }

  async listTasks(): Promise<TaskView[]> {
    const [{ data, error }, users] = await Promise.all([this.sb.from("tasks").select("*").order("created_at"), this.userMap()]);
    throwIfDbError(error, "Tasks could not be loaded");
    return ((data ?? []) as Task[]).map((t) => ({ ...t, creator: users.get(t.created_by ?? "") ?? null, assignee: t.assigned_to ? users.get(t.assigned_to) ?? null : null }));
  }
  async addTask(input: NewTaskInput) {
    const { data, error } = await this.sb.from("tasks").insert({ title: input.title, notes: input.notes ?? null, due_date: input.due_date ?? null, created_by: input.created_by }).select("*").single();
    const t = requireRow(data as Task | null, error, "Task was not saved");
    const users = await this.userMap();
    return { ...t, creator: users.get(t.created_by ?? "") ?? null, assignee: null };
  }
  async updateTask(id: string, patch: Partial<Pick<Task, "title" | "notes" | "due_date">>) {
    const { error } = await this.sb.from("tasks").update(patch).eq("id", id);
    throwIfDbError(error, "Task was not updated");
  }
  async claimTask(id: string, userId: string): Promise<ClaimResult> {
    const { data, error } = await this.sb.from("tasks").update({ assigned_to: userId }).eq("id", id).is("assigned_to", null).select("assigned_to");
    throwIfDbError(error, "Task could not be claimed");
    if (data && data.length) return { ok: true };
    const { data: cur, error: readError } = await this.sb.from("tasks").select("assigned_to").eq("id", id).maybeSingle();
    throwIfDbError(readError, "Task could not be read");
    return { ok: false, claimedBy: (cur as { assigned_to: string | null } | null)?.assigned_to ?? null };
  }
  async unclaimTask(id: string) {
    const { error } = await this.sb.from("tasks").update({ assigned_to: null }).eq("id", id);
    throwIfDbError(error, "Task was not released");
  }
  async setTaskDone(id: string, done: boolean, userId: string) {
    const { error } = await this.sb.rpc("set_task_done_atomic", { p_id: id, p_done: done, p_user_id: userId });
    throwIfDbError(error, "Task was not updated");
  }
  async deleteTask(id: string) {
    const { error } = await this.sb.from("tasks").delete().eq("id", id);
    throwIfDbError(error, "Task was not deleted");
  }

  async listInfo(): Promise<InfoGroup[]> {
    const { data, error } = await this.sb.from("important_info").select("*").order("sort_order");
    throwIfDbError(error, "Important information could not be loaded");
    const groups: InfoGroup[] = [];
    for (const item of (data ?? []) as ImportantInfo[]) {
      let g = groups.find((x) => x.category === item.category);
      if (!g) { g = { category: item.category, items: [] }; groups.push(g); }
      g.items.push(item);
    }
    return groups;
  }
  async addInfo(input: NewInfoInput) {
    const { error } = await this.sb.rpc("add_info_atomic", {
      p_category: input.category,
      p_title: input.title,
      p_content: input.content,
      p_created_by: input.created_by,
    });
    throwIfDbError(error, "Important information was not added");
  }
  async updateInfo(id: string, patch: Partial<Pick<ImportantInfo, "category" | "title" | "content" | "sort_order">>, updatedBy: string) {
    const { error } = await this.sb.from("important_info").update({ ...patch, updated_by: updatedBy }).eq("id", id);
    throwIfDbError(error, "Important information was not updated");
  }
  async deleteInfo(id: string) {
    const { error } = await this.sb.from("important_info").delete().eq("id", id);
    throwIfDbError(error, "Important information was not removed");
  }
  async listAnnouncements(): Promise<AnnouncementView[]> {
    const [{ data, error }, users] = await Promise.all([this.sb.from("announcements").select("*").order("is_pinned", { ascending: false }).order("created_at", { ascending: false }), this.userMap()]);
    throwIfDbError(error, "Announcements could not be loaded");
    return ((data ?? []) as Announcement[]).map((a) => ({ ...a, creator: a.created_by ? users.get(a.created_by) ?? null : null }));
  }
  async addAnnouncement(input: NewAnnouncementInput) {
    const { error } = await this.sb.rpc("add_announcement_atomic", {
      p_title: input.title,
      p_content: input.content ?? null,
      p_pinned: input.is_pinned,
      p_expires_at: input.expires_at ?? null,
      p_created_by: input.created_by,
    });
    throwIfDbError(error, "Announcement was not saved");
  }
  async setAnnouncementPinned(id: string, pinned: boolean) {
    const { error } = await this.sb.rpc("set_announcement_pinned_atomic", { p_id: id, p_pinned: pinned });
    throwIfDbError(error, "Announcement pin was not updated");
  }
  async deleteAnnouncement(id: string) {
    const { error } = await this.sb.from("announcements").delete().eq("id", id);
    throwIfDbError(error, "Announcement was not removed");
  }
  async listActivity(limit = 40) {
    const [{ data, error }, users] = await Promise.all([this.sb.from("activity").select("*").order("created_at", { ascending: false }).limit(limit), this.userMap()]);
    throwIfDbError(error, "Activity could not be loaded");
    return ((data ?? []) as import("@/lib/types").Activity[]).map((a) => ({ ...a, actor: a.actor_user_id ? users.get(a.actor_user_id) ?? null : null }));
  }
  async addActivity(actorId: string, type: string, text: string, entity?: { type: string; id: string }) {
    const { error } = await this.sb.from("activity").insert({ actor_user_id: actorId, type, entity_type: entity?.type ?? null, entity_id: entity?.id ?? null, metadata: { text } });
    throwIfDbError(error, "Activity was not saved");
  }

  async listPolls(userId: string): Promise<PollView[]> {
    const [pollsResult, optionsResult, votesResult, users] = await Promise.all([
      this.sb.from("polls").select("*").order("closed").order("created_at", { ascending: false }),
      this.sb.from("poll_options").select("*").order("sort_order"),
      this.sb.from("poll_votes").select("poll_id,option_id,user_id"),
      this.userMap(),
    ]);
    throwIfDbError(pollsResult.error, "Polls could not be loaded");
    throwIfDbError(optionsResult.error, "Poll options could not be loaded");
    throwIfDbError(votesResult.error, "Poll votes could not be loaded");
    const opts = (optionsResult.data ?? []) as PollOption[];
    const vts = (votesResult.data ?? []) as Pick<PollVote, "poll_id" | "option_id" | "user_id">[];
    return ((pollsResult.data ?? []) as Poll[]).map((p) => {
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
    const { data: id, error } = await this.sb.rpc("create_poll_atomic", { p_question: input.question, p_options: input.options, p_created_by: input.created_by });
    throwIfDbError(error, "Poll was not saved");
    if (typeof id !== "string") throw new Error("Poll was not saved");
    return (await this.listPolls(input.created_by)).find((x) => x.id === id)!;
  }
  async votePoll(pollId: string, optionId: string, userId: string) {
    const { data, error } = await this.sb.rpc("vote_poll_secure", { p_poll_id: pollId, p_option_id: optionId, p_user_id: userId });
    throwIfDbError(error, "Vote was not saved");
    if (data !== true) throw new Error("That poll is closed or the option is invalid");
  }
  async setPollClosed(id: string, closed: boolean) {
    const { error } = await this.sb.from("polls").update({ closed }).eq("id", id);
    throwIfDbError(error, "Poll was not updated");
  }
  async deletePoll(id: string) {
    const { error } = await this.sb.from("polls").delete().eq("id", id);
    throwIfDbError(error, "Poll was not deleted");
  }

  private async photoView(p: Photo, users: Map<string, PublicUser>): Promise<PhotoView> {
    const { data, error } = await this.sb.storage.from(PHOTO_BUCKET).createSignedUrl(p.storage_path, 60 * 60);
    throwIfDbError(error, "Photo URL could not be created");
    if (!data?.signedUrl) throw new Error("Photo URL could not be created");
    return { ...p, url: data.signedUrl, uploader: p.uploaded_by ? users.get(p.uploaded_by) ?? null : null };
  }
  async listPhotos(): Promise<PhotoView[]> {
    const [{ data, error }, users] = await Promise.all([
      this.sb.from("photos").select("*").order("created_at", { ascending: false }),
      this.userMap(),
    ]);
    throwIfDbError(error, "Photos could not be loaded");
    return Promise.all(((data ?? []) as Photo[]).map((p) => this.photoView(p, users)));
  }
  async addPhoto(input: NewPhotoInput): Promise<PhotoView> {
    const path = `${globalThis.crypto.randomUUID()}${photoExt(input.fileName, input.contentType)}`;
    const { error: upErr } = await this.sb.storage
      .from(PHOTO_BUCKET)
      .upload(path, input.bytes, { contentType: input.contentType, upsert: false });
    throwIfDbError(upErr, "Photo could not be uploaded");
    const { data, error } = await this.sb
      .from("photos")
      .insert({ storage_path: path, caption: input.caption ?? null, content_type: input.contentType, size_bytes: input.size, uploaded_by: input.uploaded_by })
      .select("*")
      .single();
    if (error) {
      // Roll back the orphaned object if the metadata insert failed.
      const { error: rollbackError } = await this.sb.storage.from(PHOTO_BUCKET).remove([path]);
      if (rollbackError) console.error("[SupabaseRepo] Photo rollback failed:", rollbackError.message);
      throwIfDbError(error, "Photo details could not be saved");
    }
    return this.photoView(data as Photo, await this.userMap());
  }
  async updatePhotoCaption(id: string, caption: string | null) {
    const { error } = await this.sb.from("photos").update({ caption }).eq("id", id);
    throwIfDbError(error, "Caption was not updated");
  }
  async deletePhoto(id: string) {
    const { data, error } = await this.sb.from("photos").delete().eq("id", id).select("storage_path").maybeSingle();
    throwIfDbError(error, "Photo could not be removed");
    const path = (data as { storage_path: string } | null)?.storage_path;
    if (path) {
      const { error: storageError } = await this.sb.storage.from(PHOTO_BUCKET).remove([path]);
      if (storageError) console.error("[SupabaseRepo] Orphaned photo file could not be removed:", storageError.message);
    }
  }
}

let instance: SupabaseRepo | null = null;
export function getSupabaseRepo(): Repo {
  instance ??= new SupabaseRepo();
  return instance;
}
