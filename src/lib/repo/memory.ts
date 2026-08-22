import type {
  Activity,
  Announcement,
  AppSettings,
  FlightLeg,
  FlightStatus,
  ImportantInfo,
  Photo,
  Pickup,
  Place,
  Plan,
  PlanAttendee,
  Poll,
  PublicUser,
  ShoppingItem,
  Task,
  TravelGroup,
  User,
} from "@/lib/types";
import { buildSeed } from "./seed";
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

const nowIso = () => new Date().toISOString();
const uid = () => globalThis.crypto.randomUUID();

function toPublic(u: User): PublicUser {
  const { pin_hash: _pin, phone_number: _phone, ...rest } = u;
  void _pin;
  void _phone;
  return rest;
}

class MemoryRepo implements Repo {
  readonly kind = "memory" as const;
  private d = buildSeed();
  // No object storage in memory mode: hold the bytes inline as a data URL so
  // the gallery still renders when running without Supabase credentials.
  private photos: (Photo & { _url: string })[] = [];

  private user(id: string | null): PublicUser | null {
    if (!id) return null;
    const u = this.d.users.find((x) => x.id === id);
    return u ? toPublic(u) : null;
  }
  private legsFor(tgId: string): FlightLeg[] {
    return this.d.legs.filter((l) => l.travel_group_id === tgId).sort((a, b) => a.leg_order - b.leg_order);
  }
  private activeLeg(legs: FlightLeg[]): FlightLeg | null {
    return legs.find((l) => l.status === "air") ?? legs[legs.length - 1] ?? null;
  }
  private travelView(tg: TravelGroup): TravelView {
    const legs = this.legsFor(tg.id);
    const memberIds = this.d.members.filter((m) => m.travel_group_id === tg.id).map((m) => m.user_id);
    const active = this.activeLeg(legs);
    const last = legs[legs.length - 1] ?? null;
    const pickup = this.d.pickups.find((p) => p.travel_group_id === tg.id) ?? null;
    return {
      ...tg,
      members: memberIds.map((id) => this.user(id)).filter(Boolean) as PublicUser[],
      legs,
      pickup,
      driver: pickup?.driver_user_id ? this.user(pickup.driver_user_id) : null,
      activeLeg: active,
      arrivalIso: last?.actual_arrival ?? last?.estimated_arrival ?? last?.scheduled_arrival ?? null,
    };
  }

  async getSettings(): Promise<AppSettings> {
    return this.d.settings;
  }
  async updateSettings(patch: Partial<AppSettings>) {
    this.d.settings = { ...this.d.settings, ...patch, updated_at: nowIso() };
  }

  async listUsers() {
    return this.d.users.map(toPublic).sort((a, b) => a.name.localeCompare(b.name));
  }
  async getUser(id: string) {
    return this.user(id);
  }
  async getUserWithPin(username: string) {
    const u = this.d.users.find((x) => x.username.toLowerCase() === username.toLowerCase());
    return u ? { id: u.id, pin_hash: u.pin_hash } : null;
  }
  async usernameTaken(username: string) {
    return this.d.users.some((x) => x.username.toLowerCase() === username.toLowerCase());
  }
  async createUser(input: NewUserInput) {
    const u: User = {
      id: uid(), name: input.name, username: input.username, emoji: input.emoji,
      pin_hash: input.pinHash, is_admin: input.is_admin ?? false, status: input.status ?? "here",
      roles: [], staying_at: null, pin_reset_requested: false, phone_number: null, prefs: {},
      created_at: nowIso(), updated_at: nowIso(),
    };
    this.d.users.push(u);
    return toPublic(u);
  }
  async listPending() {
    return this.d.users.filter((u) => !u.pin_hash.includes(":")).map(toPublic).sort((a, b) => a.name.localeCompare(b.name));
  }
  async claimUser(id: string, patch: { emoji: string; pinHash: string }) {
    const u = this.d.users.find((x) => x.id === id);
    if (!u || u.pin_hash.includes(":")) return null;
    u.emoji = patch.emoji; u.pin_hash = patch.pinHash; u.updated_at = nowIso();
    return toPublic(u);
  }
  async listRoster(): Promise<RosterUser[]> {
    return this.d.users
      .map((u) => ({ ...toPublic(u), claimed: u.pin_hash.includes(":"), phone_number: u.phone_number ?? null }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
  async resetUserPin(id: string) {
    const u = this.d.users.find((x) => x.id === id);
    if (u) { u.pin_hash = "PENDING"; u.pin_reset_requested = false; u.updated_at = nowIso(); }
  }
  async requestPinReset(username: string) {
    const u = this.d.users.find((x) => x.username.toLowerCase() === username.toLowerCase());
    if (!u) return false;
    u.pin_reset_requested = true; u.updated_at = nowIso();
    return true;
  }
  async setUserRoles(id: string, roles: string[]) {
    const u = this.d.users.find((x) => x.id === id);
    if (u) { u.roles = roles; u.updated_at = nowIso(); }
  }
  async setUserLocation(id: string, stayingAt: string | null) {
    const u = this.d.users.find((x) => x.id === id);
    if (u) { u.staying_at = stayingAt; u.updated_at = nowIso(); }
  }
  async listPhoneNumbers(): Promise<Record<string, string | null>> {
    const out: Record<string, string | null> = {};
    this.d.users.forEach((u) => (out[u.id] = u.phone_number ?? null));
    return out;
  }
  async setUserPhone(id: string, phone: string | null) {
    const u = this.d.users.find((x) => x.id === id);
    if (u) { u.phone_number = phone; u.updated_at = nowIso(); }
  }
  async setUserPrefs(id: string, prefs: import("@/lib/types").UserPrefs) {
    const u = this.d.users.find((x) => x.id === id);
    if (u) { u.prefs = prefs; u.updated_at = nowIso(); }
  }
  async deleteUser(id: string) {
    this.d.users = this.d.users.filter((u) => u.id !== id);
  }
  async listPlaces() {
    return [...this.d.places].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }
  async createPlace(input: NewPlaceInput) {
    const p: Place = {
      id: uid(), name: input.name, address: input.address ?? null, notes: input.notes ?? null,
      sort_order: this.d.places.length, created_by: input.created_by, created_at: nowIso(), updated_at: nowIso(),
    };
    this.d.places.push(p);
    return p;
  }
  async updatePlace(id: string, patch: Partial<Pick<Place, "name" | "address" | "notes" | "sort_order">>) {
    const p = this.d.places.find((x) => x.id === id);
    if (p) { Object.assign(p, patch); p.updated_at = nowIso(); }
  }
  async deletePlace(id: string) {
    this.d.places = this.d.places.filter((p) => p.id !== id);
  }
  async setAdmin(id: string, isAdmin: boolean) {
    const u = this.d.users.find((x) => x.id === id);
    if (u) { u.is_admin = isAdmin; u.updated_at = nowIso(); }
  }
  async setUserStatus(id: string, status: User["status"]) {
    const u = this.d.users.find((x) => x.id === id);
    if (u) { u.status = status; u.updated_at = nowIso(); }
  }

  private planView(p: Plan): PlanView {
    const attendees = this.d.planAttendees.filter((a) => a.plan_id === p.id).map((a) => this.user(a.user_id)).filter(Boolean) as PublicUser[];
    return { ...p, attendees, creator: this.user(p.created_by) };
  }
  async listPlans() {
    return this.d.plans
      .slice()
      .sort((a, b) => (a.date + (a.start_time ?? "")).localeCompare(b.date + (b.start_time ?? "")))
      .map((p) => this.planView(p));
  }
  async getPlan(id: string) {
    const p = this.d.plans.find((x) => x.id === id);
    return p ? this.planView(p) : null;
  }
  async createPlan(input: NewPlanInput) {
    const p: Plan = {
      id: uid(), title: input.title, description: input.description ?? null, category: input.category,
      date: input.date, start_time: input.start_time ?? null, location: input.location ?? null,
      anyone_can_join: input.anyone_can_join, created_by: input.created_by, created_at: nowIso(), updated_at: nowIso(),
    };
    this.d.plans.push(p);
    for (const uidv of new Set(input.attendees)) {
      this.d.planAttendees.push({ id: uid(), plan_id: p.id, user_id: uidv, added_by: input.created_by, created_at: nowIso() });
    }
    return this.planView(p);
  }
  async deletePlan(id: string) {
    this.d.plans = this.d.plans.filter((p) => p.id !== id);
    this.d.planAttendees = this.d.planAttendees.filter((a) => a.plan_id !== id);
  }
  async joinPlan(planId: string, userId: string, addedBy: string) {
    if (this.d.planAttendees.some((a) => a.plan_id === planId && a.user_id === userId)) return;
    this.d.planAttendees.push({ id: uid(), plan_id: planId, user_id: userId, added_by: addedBy, created_at: nowIso() } as PlanAttendee);
  }
  async leavePlan(planId: string, userId: string) {
    this.d.planAttendees = this.d.planAttendees.filter((a) => !(a.plan_id === planId && a.user_id === userId));
  }

  async listTravel() {
    return this.d.travel.map((t) => this.travelView(t)).sort((a, b) => (a.arrivalIso ?? "").localeCompare(b.arrivalIso ?? ""));
  }
  async getTravel(id: string) {
    const t = this.d.travel.find((x) => x.id === id);
    return t ? this.travelView(t) : null;
  }
  async createTravel(input: NewTravelInput) {
    const tg: TravelGroup = {
      id: uid(), title: input.title, status: "upcoming", accommodation: null, luggage_notes: null,
      general_notes: input.notes ?? null, created_by: input.created_by, created_at: nowIso(), updated_at: nowIso(),
    };
    this.d.travel.push(tg);
    for (const u of input.travellers) this.d.members.push({ travel_group_id: tg.id, user_id: u });
    let firstLegId: string | null = null;
    for (const l of input.legs) {
      const leg: FlightLeg = {
        id: uid(), travel_group_id: tg.id, leg_order: l.leg_order, provider: l.provider ?? "demo",
        provider_flight_id: l.provider_flight_id ?? null, flight_number: l.flight_number,
        airline_code: l.airline_code ?? null, airline_name: l.airline_name ?? null,
        origin_airport: l.origin_airport, origin_city: l.origin_city ?? null,
        destination_airport: l.destination_airport, destination_city: l.destination_city ?? null,
        scheduled_departure: l.scheduled_departure ?? null, estimated_departure: null, actual_departure: null,
        scheduled_arrival: l.scheduled_arrival ?? null, estimated_arrival: l.estimated_arrival ?? null, actual_arrival: null,
        terminal_departure: l.terminal_departure ?? null, gate_departure: null, terminal_arrival: null, gate_arrival: null,
        aircraft_type: l.aircraft_type ?? null, aircraft_type_code: l.aircraft_type_code ?? null,
        aircraft_registration: l.aircraft_registration ?? null, status: l.status ?? "scheduled", progress: 0,
        progress_source: null,
        delay_minutes: 0, last_synced_at: nowIso(), created_at: nowIso(), updated_at: nowIso(),
      };
      this.d.legs.push(leg);
      firstLegId ??= leg.id;
    }
    if (input.pickup) {
      this.d.pickups.push({ id: uid(), travel_group_id: tg.id, flight_leg_id: firstLegId, requested: true, driver_user_id: null, driver_en_route: false, notes: null, created_at: nowIso(), updated_at: nowIso() });
    }
    return this.travelView(tg);
  }
  async setTravelStatus(id: string, status: TravelGroup["status"]) {
    const t = this.d.travel.find((x) => x.id === id);
    if (t) { t.status = status; t.updated_at = nowIso(); }
  }
  async setLegStatus(legId: string, status: FlightStatus, progress: number | null) {
    const l = this.d.legs.find((x) => x.id === legId);
    if (l) { l.status = status; if (progress != null) l.progress = progress; l.updated_at = nowIso(); }
  }
  async syncLeg(legId: string, patch: Partial<FlightLeg>) {
    const l = this.d.legs.find((x) => x.id === legId);
    if (l) Object.assign(l, patch, { last_synced_at: nowIso(), updated_at: nowIso() });
  }

  private pickupOf(tgId: string): Pickup | undefined {
    return this.d.pickups.find((p) => p.travel_group_id === tgId);
  }
  async requestPickup(travelGroupId: string, flightLegId: string | null) {
    const existing = this.pickupOf(travelGroupId);
    if (existing) { existing.requested = true; existing.updated_at = nowIso(); return; }
    this.d.pickups.push({ id: uid(), travel_group_id: travelGroupId, flight_leg_id: flightLegId, requested: true, driver_user_id: null, driver_en_route: false, notes: null, created_at: nowIso(), updated_at: nowIso() });
  }
  async claimPickup(travelGroupId: string, userId: string): Promise<ClaimResult> {
    const p = this.pickupOf(travelGroupId);
    if (!p) return { ok: false, claimedBy: null };
    if (p.driver_user_id) return { ok: false, claimedBy: p.driver_user_id };
    p.driver_user_id = userId; p.updated_at = nowIso();
    return { ok: true };
  }
  async assignPickup(travelGroupId: string, driverUserId: string) {
    const p = this.pickupOf(travelGroupId);
    if (p) { p.driver_user_id = driverUserId; p.driver_en_route = false; p.updated_at = nowIso(); }
  }
  async releasePickup(travelGroupId: string) {
    const p = this.pickupOf(travelGroupId);
    if (p) { p.driver_user_id = null; p.driver_en_route = false; p.updated_at = nowIso(); }
  }
  async setPickupEnRoute(travelGroupId: string, enRoute: boolean) {
    const p = this.pickupOf(travelGroupId);
    if (p) { p.driver_en_route = enRoute; p.updated_at = nowIso(); }
  }

  private shoppingView(s: ShoppingItem): ShoppingView {
    return { ...s, creator: this.user(s.created_by), claimer: this.user(s.claimed_by) };
  }
  async listShopping() {
    return this.d.shopping.map((s) => this.shoppingView(s));
  }
  async addShopping(input: NewShoppingInput) {
    const s: ShoppingItem = {
      id: uid(), item: input.item, quantity: input.quantity, category: input.category, notes: input.notes ?? null,
      created_by: input.created_by, claimed_by: input.claimed_by ?? null, completed: false, completed_at: null, created_at: nowIso(), updated_at: nowIso(),
    };
    this.d.shopping.push(s);
    return this.shoppingView(s);
  }
  async setShoppingQuantity(id: string, quantity: number) {
    const s = this.d.shopping.find((x) => x.id === id);
    if (s) { s.quantity = Math.max(1, Math.floor(quantity)); s.updated_at = nowIso(); }
  }
  async assignShopping(id: string, userId: string | null) {
    const s = this.d.shopping.find((x) => x.id === id);
    if (s) { s.claimed_by = userId; s.updated_at = nowIso(); }
  }
  async claimShopping(id: string, userId: string): Promise<ClaimResult> {
    const s = this.d.shopping.find((x) => x.id === id);
    if (!s) return { ok: false, claimedBy: null };
    if (s.claimed_by) return { ok: false, claimedBy: s.claimed_by };
    s.claimed_by = userId; s.updated_at = nowIso();
    return { ok: true };
  }
  async unclaimShopping(id: string) {
    const s = this.d.shopping.find((x) => x.id === id);
    if (s) { s.claimed_by = null; s.updated_at = nowIso(); }
  }
  async setShoppingDone(id: string, done: boolean, userId: string) {
    const s = this.d.shopping.find((x) => x.id === id);
    if (s) { s.completed = done; s.completed_at = done ? nowIso() : null; if (done && !s.claimed_by) s.claimed_by = userId; s.updated_at = nowIso(); }
  }

  private taskView(t: Task): TaskView {
    return { ...t, creator: this.user(t.created_by), assignee: this.user(t.assigned_to) };
  }
  async listTasks() {
    return this.d.tasks.map((t) => this.taskView(t));
  }
  async addTask(input: NewTaskInput) {
    const t: Task = {
      id: uid(), title: input.title, notes: input.notes ?? null, due_date: input.due_date ?? null, due_time: null,
      created_by: input.created_by, assigned_to: null, completed: false, completed_at: null, created_at: nowIso(), updated_at: nowIso(),
    };
    this.d.tasks.push(t);
    return this.taskView(t);
  }
  async updateTask(id: string, patch: Partial<Pick<Task, "title" | "notes" | "due_date">>) {
    const t = this.d.tasks.find((x) => x.id === id);
    if (t) { Object.assign(t, patch); t.updated_at = nowIso(); }
  }
  async claimTask(id: string, userId: string): Promise<ClaimResult> {
    const t = this.d.tasks.find((x) => x.id === id);
    if (!t) return { ok: false, claimedBy: null };
    if (t.assigned_to) return { ok: false, claimedBy: t.assigned_to };
    t.assigned_to = userId; t.updated_at = nowIso();
    return { ok: true };
  }
  async unclaimTask(id: string) {
    const t = this.d.tasks.find((x) => x.id === id);
    if (t) { t.assigned_to = null; t.updated_at = nowIso(); }
  }
  async setTaskDone(id: string, done: boolean, userId: string) {
    const t = this.d.tasks.find((x) => x.id === id);
    if (t) { t.completed = done; t.completed_at = done ? nowIso() : null; if (done && !t.assigned_to) t.assigned_to = userId; t.updated_at = nowIso(); }
  }
  async deleteTask(id: string) {
    this.d.tasks = this.d.tasks.filter((x) => x.id !== id);
  }

  async listInfo(): Promise<InfoGroup[]> {
    const groups: InfoGroup[] = [];
    for (const item of [...this.d.info].sort((a, b) => a.sort_order - b.sort_order)) {
      let g = groups.find((x) => x.category === item.category);
      if (!g) { g = { category: item.category, items: [] }; groups.push(g); }
      g.items.push(item);
    }
    return groups;
  }
  async addInfo(input: NewInfoInput) {
    const maxOrder = this.d.info.filter((i) => i.category === input.category).reduce((m, i) => Math.max(m, i.sort_order), -1);
    this.d.info.push({
      id: uid(), category: input.category, title: input.title, content: input.content,
      sort_order: maxOrder + 1, created_by: input.created_by, updated_by: input.created_by,
      created_at: nowIso(), updated_at: nowIso(),
    } as ImportantInfo);
  }
  async updateInfo(id: string, patch: Partial<Pick<ImportantInfo, "category" | "title" | "content" | "sort_order">>, updatedBy: string) {
    const i = this.d.info.find((x) => x.id === id);
    if (i) { Object.assign(i, patch); i.updated_by = updatedBy; i.updated_at = nowIso(); }
  }
  async deleteInfo(id: string) {
    this.d.info = this.d.info.filter((i) => i.id !== id);
  }
  async listAnnouncements(): Promise<AnnouncementView[]> {
    return [...this.d.announcements]
      .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.created_at.localeCompare(a.created_at))
      .map((a) => ({ ...a, creator: this.user(a.created_by) }));
  }
  async addAnnouncement(input: NewAnnouncementInput) {
    if (input.is_pinned) this.d.announcements.forEach((a) => (a.is_pinned = false));
    this.d.announcements.unshift({
      id: uid(), title: input.title, content: input.content ?? null, is_pinned: input.is_pinned,
      starts_at: null, expires_at: input.expires_at ?? null, created_by: input.created_by, created_at: nowIso(), updated_at: nowIso(),
    } as Announcement);
  }
  async setAnnouncementPinned(id: string, pinned: boolean) {
    if (pinned) this.d.announcements.forEach((a) => (a.is_pinned = false));
    const a = this.d.announcements.find((x) => x.id === id);
    if (a) { a.is_pinned = pinned; a.updated_at = nowIso(); }
  }
  async deleteAnnouncement(id: string) {
    this.d.announcements = this.d.announcements.filter((a) => a.id !== id);
  }
  async listActivity(limit = 40) {
    return [...this.d.activity]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit)
      .map((a) => ({ ...a, actor: this.user(a.actor_user_id) }));
  }
  async addActivity(actorId: string, type: string, text: string, entity?: { type: string; id: string }) {
    this.d.activity.unshift({
      id: uid(), actor_user_id: actorId, type, entity_type: entity?.type ?? null, entity_id: entity?.id ?? null,
      metadata: { text }, created_at: nowIso(),
    } as Activity);
  }

  private pollView(p: Poll, userId: string): PollView {
    const opts = this.d.pollOptions.filter((o) => o.poll_id === p.id).sort((a, b) => a.sort_order - b.sort_order);
    const votes = this.d.pollVotes.filter((v) => v.poll_id === p.id);
    const myVote = votes.find((v) => v.user_id === userId) ?? null;
    return {
      ...p,
      options: opts.map((o) => ({ ...o, votes: votes.filter((v) => v.option_id === o.id).length })),
      total: votes.length,
      myOptionId: myVote?.option_id ?? null,
      creator: this.user(p.created_by),
    };
  }
  async listPolls(userId: string): Promise<PollView[]> {
    return [...this.d.polls]
      .sort((a, b) => Number(a.closed) - Number(b.closed) || b.created_at.localeCompare(a.created_at))
      .map((p) => this.pollView(p, userId));
  }
  async createPoll(input: NewPollInput): Promise<PollView> {
    const p: Poll = { id: uid(), question: input.question, closed: false, created_by: input.created_by, created_at: nowIso(), updated_at: nowIso() };
    this.d.polls.push(p);
    input.options.forEach((label, i) => this.d.pollOptions.push({ id: uid(), poll_id: p.id, label, sort_order: i }));
    return this.pollView(p, input.created_by);
  }
  async votePoll(pollId: string, optionId: string, userId: string) {
    const existing = this.d.pollVotes.find((v) => v.poll_id === pollId && v.user_id === userId);
    if (existing) { existing.option_id = optionId; existing.created_at = nowIso(); return; }
    this.d.pollVotes.push({ id: uid(), poll_id: pollId, option_id: optionId, user_id: userId, created_at: nowIso() });
  }
  async setPollClosed(id: string, closed: boolean) {
    const p = this.d.polls.find((x) => x.id === id);
    if (p) { p.closed = closed; p.updated_at = nowIso(); }
  }
  async deletePoll(id: string) {
    this.d.polls = this.d.polls.filter((p) => p.id !== id);
    this.d.pollOptions = this.d.pollOptions.filter((o) => o.poll_id !== id);
    this.d.pollVotes = this.d.pollVotes.filter((v) => v.poll_id !== id);
  }

  async listPhotos(): Promise<PhotoView[]> {
    return this.photos.map((p) => ({ ...p, url: p._url, uploader: this.user(p.uploaded_by) }));
  }
  async addPhoto(input: NewPhotoInput): Promise<PhotoView> {
    const url = `data:${input.contentType};base64,${Buffer.from(input.bytes).toString("base64")}`;
    const p: Photo & { _url: string } = {
      id: uid(), storage_path: url, caption: input.caption ?? null, content_type: input.contentType,
      size_bytes: input.size, uploaded_by: input.uploaded_by, created_at: nowIso(), _url: url,
    };
    this.photos.unshift(p);
    return { ...p, url, uploader: this.user(input.uploaded_by) };
  }
  async updatePhotoCaption(id: string, caption: string | null) {
    const p = this.photos.find((x) => x.id === id);
    if (p) p.caption = caption;
  }
  async deletePhoto(id: string) {
    this.photos = this.photos.filter((p) => p.id !== id);
  }
}

// Persist across HMR / requests in dev.
const g = globalThis as unknown as { __zimMemoryRepo?: MemoryRepo };
export function getMemoryRepo(): Repo {
  g.__zimMemoryRepo ??= new MemoryRepo();
  return g.__zimMemoryRepo;
}
