import type {
  Activity,
  Announcement,
  AppSettings,
  FlightLeg,
  FlightStatus,
  ImportantInfo,
  Place,
  Plan,
  PlanCategory,
  Pickup,
  PublicUser,
  ShoppingItem,
  Task,
  TravelGroup,
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

// ---- inputs ----
export interface NewUserInput {
  name: string;
  username: string;
  emoji: string;
  pinHash: string;
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
  created_by: string;
}

export type ClaimResult = { ok: true } | { ok: false; claimedBy: string | null };

/** A roster row for the admin panel: public fields plus whether they've claimed. */
export type RosterUser = PublicUser & { claimed: boolean };

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
  getUserWithPin(username: string): Promise<{ id: string; pin_hash: string } | null>;
  usernameTaken(username: string): Promise<boolean>;
  createUser(input: NewUserInput): Promise<PublicUser>;
  /** Admin-provisioned identities not yet claimed (sentinel PIN). */
  listPending(): Promise<PublicUser[]>;
  /** Claim a pending identity: set emoji + real PIN. Returns null if already claimed. */
  claimUser(id: string, patch: { emoji: string; pinHash: string }): Promise<PublicUser | null>;
  /** Admin roster: every user plus whether they've claimed their identity. */
  listRoster(): Promise<RosterUser[]>;
  resetUserPin(id: string): Promise<void>;
  setUserRoles(id: string, roles: string[]): Promise<void>;
  setUserLocation(id: string, stayingAt: string | null): Promise<void>;
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
  requestPickup(travelGroupId: string, flightLegId: string | null): Promise<void>;
  claimPickup(travelGroupId: string, userId: string): Promise<ClaimResult>;
  releasePickup(travelGroupId: string): Promise<void>;

  // shopping
  listShopping(): Promise<ShoppingView[]>;
  addShopping(input: NewShoppingInput): Promise<ShoppingView>;
  claimShopping(id: string, userId: string): Promise<ClaimResult>;
  unclaimShopping(id: string): Promise<void>;
  setShoppingDone(id: string, done: boolean, userId: string): Promise<void>;

  // tasks
  listTasks(): Promise<TaskView[]>;
  addTask(input: NewTaskInput): Promise<TaskView>;
  claimTask(id: string, userId: string): Promise<ClaimResult>;
  unclaimTask(id: string): Promise<void>;
  setTaskDone(id: string, done: boolean, userId: string): Promise<void>;

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
}
