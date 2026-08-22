import type {
  Activity,
  Announcement,
  AppSettings,
  FlightLeg,
  FlightStatus,
  ImportantInfo,
  Photo,
  Place,
  Plan,
  PlanCategory,
  Pickup,
  Poll,
  PollOption,
  PublicUser,
  ShoppingItem,
  Task,
  TravelGroup,
  UserPrefs,
} from "@/lib/types";

// ---- view models (joined for the UI) ----
export interface PlanView extends Plan {
  attendees: PublicUser[];
  creator: PublicUser | null;
}
export interface TravelView extends TravelGroup {
  members: PublicUser[];
  legs: FlightLeg[];
  pickup: Pickup | null;
  /** Every requested airport pickup, keyed to its actual arrival leg. */
  pickups: Pickup[];
  driver: PublicUser | null;
  activeLeg: FlightLeg | null;
  arrivalIso: string | null;
}
export interface ShoppingView extends ShoppingItem {
  creator: PublicUser | null;
  claimer: PublicUser | null;
}
export interface TaskView extends Task {
  creator: PublicUser | null;
  assignee: PublicUser | null;
}
export interface InfoGroup {
  category: string;
  items: ImportantInfo[];
}
export interface ActivityView extends Activity {
  actor: PublicUser | null;
}
export interface AnnouncementView extends Announcement {
  creator: PublicUser | null;
}
export interface PollOptionView extends PollOption {
  votes: number;
}
export interface PollView extends Poll {
  options: PollOptionView[];
  total: number;
  myOptionId: string | null;
  creator: PublicUser | null;
}
export interface PhotoView extends Photo {
  /** Short-lived signed URL in Supabase, or a data URL in memory mode. */
  url: string;
  uploader: PublicUser | null;
}

// ---- inputs ----
export interface NewUserInput {
  name: string;
  username: string;
  emoji: string;
  pinHash: string;
  claimTokenHash: string;
  is_admin?: boolean;
  status?: "upcoming" | "travelling" | "here";
}
export interface NewLegInput {
  leg_order: number;
  flight_number: string;
  airline_code?: string | null;
  airline_name?: string | null;
  origin_airport: string;
  origin_city?: string | null;
  destination_airport: string;
  destination_city?: string | null;
  scheduled_departure?: string | null;
  scheduled_arrival?: string | null;
  estimated_arrival?: string | null;
  aircraft_type?: string | null;
  aircraft_type_code?: string | null;
  aircraft_registration?: string | null;
  terminal_departure?: string | null;
  status?: FlightStatus;
  provider?: string | null;
  provider_flight_id?: string | null;
}
export interface NewTravelInput {
  title: string;
  travellers: string[];
  created_by: string;
  pickup: boolean;
  notes?: string | null;
  legs: NewLegInput[];
}
export interface NewPlanInput {
  title: string;
  description?: string | null;
  category: PlanCategory;
  date: string;
  start_time?: string | null;
  location?: string | null;
  anyone_can_join: boolean;
  created_by: string;
  attendees: string[];
}
export interface NewShoppingInput {
  item: string;
  quantity: number;
  category: string;
  notes?: string | null;
  created_by: string;
  claimed_by?: string | null;
}
export interface NewTaskInput {
  title: string;
  notes?: string | null;
  due_date?: string | null;
  created_by: string;
}
export interface NewAnnouncementInput {
  title: string;
  content?: string | null;
  is_pinned: boolean;
  expires_at?: string | null;
  created_by: string;
}
export interface NewPollInput {
  question: string;
  options: string[];
  created_by: string;
}
export interface NewPhotoInput {
  bytes: Uint8Array;
  fileName: string;
  contentType: string;
  size: number;
  caption?: string | null;
  uploaded_by: string;
}

export type ClaimResult = { ok: true } | { ok: false; claimedBy: string | null };

/**
 * A roster row for the admin panel: public fields, whether they've claimed, and
 * their phone number. The one admin-facing projection of a user.
 */
export type RosterUser = PublicUser & { claimed: boolean; phone_number: string | null };

export interface NewInfoInput {
  category: string;
  title: string;
  content: string;
  created_by: string;
}
export interface NewPlaceInput {
  name: string;
  address?: string | null;
  notes?: string | null;
  created_by: string;
}

export interface Repo {
  readonly kind: "memory" | "supabase";

  // settings + users
  getSettings(): Promise<AppSettings>;
  updateSettings(patch: Partial<Pick<AppSettings, "app_title" | "wedding_date" | "wedding_url">>): Promise<void>;
  listUsers(): Promise<PublicUser[]>;
  getUser(id: string): Promise<PublicUser | null>;
  getUserWithPin(id: string): Promise<{ id: string; pin_hash: string; session_version: number } | null>;
  getSessionVersion(id: string): Promise<number | null>;
  usernameTaken(username: string): Promise<boolean>;
  createUser(input: NewUserInput): Promise<PublicUser>;
  /** Admin-provisioned identities not yet claimed (sentinel PIN). */
  listPending(): Promise<PublicUser[]>;
  /** Claim a pending identity: set emoji + real PIN. Returns null if already claimed. */
  claimUser(id: string, patch: { emoji: string; pinHash: string; claimTokenHash: string }): Promise<{ user: PublicUser; sessionVersion: number } | null>;
  /** Admin roster: every user plus whether they've claimed their identity. */
  listRoster(): Promise<RosterUser[]>;
  resetUserPin(id: string, claimTokenHash: string): Promise<void>;
  /** Public: flag that a person wants their PIN reset. Returns false if unknown. */
  requestPinReset(userId: string): Promise<boolean>;
  /** Atomically consume an auth attempt. False means the key is temporarily blocked. */
  consumeAuthAttempt(key: string): Promise<boolean>;
  clearAuthAttempts(key: string): Promise<void>;
  setUserRoles(id: string, roles: string[]): Promise<void>;
  setUserLocation(id: string, stayingAt: string | null): Promise<void>;
  /** Admin-only: phone numbers keyed by user id. Callers MUST gate on is_admin. */
  listPhoneNumbers(): Promise<Record<string, string | null>>;
  setUserPhone(id: string, phone: string | null): Promise<void>;
  /** Self-serve: persist a person's UI preferences (home layout). */
  setUserPrefs(id: string, prefs: UserPrefs): Promise<void>;
  deleteUser(id: string): Promise<void>;
  setAdmin(id: string, isAdmin: boolean): Promise<void>;
  setUserStatus(id: string, status: "upcoming" | "travelling" | "here"): Promise<void>;

  // places
  listPlaces(): Promise<Place[]>;
  createPlace(input: NewPlaceInput): Promise<Place>;
  updatePlace(id: string, patch: Partial<Pick<Place, "name" | "address" | "notes" | "sort_order">>): Promise<void>;
  deletePlace(id: string): Promise<void>;

  // plans
  listPlans(): Promise<PlanView[]>;
  getPlan(id: string): Promise<PlanView | null>;
  createPlan(input: NewPlanInput): Promise<PlanView>;
  deletePlan(id: string): Promise<void>;
  joinPlan(planId: string, userId: string, addedBy: string): Promise<void>;
  leavePlan(planId: string, userId: string): Promise<void>;

  // travel + flights
  listTravel(): Promise<TravelView[]>;
  getTravel(id: string): Promise<TravelView | null>;
  createTravel(input: NewTravelInput): Promise<TravelView>;
  setTravelStatus(id: string, status: "upcoming" | "travelling" | "arrived"): Promise<void>;
  setLegStatus(legId: string, status: FlightStatus, progress: number | null): Promise<void>;
  syncLeg(legId: string, patch: Partial<FlightLeg>): Promise<void>;

  // pickups
  getPickup(id: string): Promise<Pickup | null>;
  setPickupRequested(travelGroupId: string, flightLegId: string, requested: boolean): Promise<void>;
  claimPickup(pickupId: string, userId: string): Promise<ClaimResult>;
  /** Force-set the driver (admin reassign); clears any en-route flag. */
  assignPickup(pickupId: string, driverUserId: string): Promise<void>;
  releasePickup(pickupId: string): Promise<void>;
  setPickupEnRoute(pickupId: string, enRoute: boolean): Promise<void>;

  // shopping
  listShopping(): Promise<ShoppingView[]>;
  addShopping(input: NewShoppingInput): Promise<ShoppingView>;
  addOrMergeShopping(input: NewShoppingInput): Promise<{ id: string }>;
  setShoppingQuantity(id: string, quantity: number): Promise<void>;
  assignShopping(id: string, userId: string | null): Promise<void>;
  claimShopping(id: string, userId: string): Promise<ClaimResult>;
  unclaimShopping(id: string): Promise<void>;
  setShoppingDone(id: string, done: boolean, userId: string): Promise<void>;

  // tasks
  listTasks(): Promise<TaskView[]>;
  addTask(input: NewTaskInput): Promise<TaskView>;
  updateTask(id: string, patch: Partial<Pick<Task, "title" | "notes" | "due_date">>): Promise<void>;
  claimTask(id: string, userId: string): Promise<ClaimResult>;
  unclaimTask(id: string): Promise<void>;
  setTaskDone(id: string, done: boolean, userId: string): Promise<void>;
  deleteTask(id: string): Promise<void>;

  // info + announcements + activity
  listInfo(): Promise<InfoGroup[]>;
  addInfo(input: NewInfoInput): Promise<void>;
  updateInfo(id: string, patch: Partial<Pick<ImportantInfo, "category" | "title" | "content" | "sort_order">>, updatedBy: string): Promise<void>;
  deleteInfo(id: string): Promise<void>;
  listAnnouncements(): Promise<AnnouncementView[]>;
  addAnnouncement(input: NewAnnouncementInput): Promise<void>;
  setAnnouncementPinned(id: string, pinned: boolean): Promise<void>;
  deleteAnnouncement(id: string): Promise<void>;
  listActivity(limit?: number): Promise<ActivityView[]>;
  addActivity(actorId: string, type: string, text: string, entity?: { type: string; id: string }): Promise<void>;

  // polls
  listPolls(userId: string): Promise<PollView[]>;
  createPoll(input: NewPollInput): Promise<PollView>;
  votePoll(pollId: string, optionId: string, userId: string): Promise<void>;
  setPollClosed(id: string, closed: boolean): Promise<void>;
  deletePoll(id: string): Promise<void>;

  // photos
  listPhotos(): Promise<PhotoView[]>;
  addPhoto(input: NewPhotoInput): Promise<PhotoView>;
  updatePhotoCaption(id: string, caption: string | null): Promise<void>;
  deletePhoto(id: string): Promise<void>;
}
