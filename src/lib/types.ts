// Domain types for Zim 2026. Mirror the SQL schema in supabase/migrations.

export type TravelStatus = "upcoming" | "travelling" | "arrived";
export type LocationStatus = "upcoming" | "travelling" | "here";
export type FlightStatus =
  | "scheduled"
  | "boarding"
  | "air"
  | "landed"
  | "cancelled"
  | "diverted"
  | "unknown";

export type PlanCategory =
  | "travel"
  | "family"
  | "wedding"
  | "dinner"
  | "shopping"
  | "transport"
  | "social"
  | "important";

/** One surface's home layout: the widget order plus any the person hid. */
export interface SurfaceLayout {
  order: string[];
  hidden: string[];
}

/** Per-person UI preferences. Empty object means "use the app defaults". */
export interface UserPrefs {
  home?: {
    mobile?: SurfaceLayout;
    desktop?: SurfaceLayout;
  };
}

export interface User {
  id: string;
  name: string;
  username: string;
  emoji: string;
  pin_hash: string;
  is_admin: boolean;
  status: LocationStatus;
  roles: string[];
  staying_at: string | null;
  /** Set when the person asks an admin to reset their PIN; cleared on reset. */
  pin_reset_requested: boolean;
  /** UI preferences (customisable home layout). */
  prefs: UserPrefs;
  created_at: string;
  updated_at: string;
}

/** Known role slugs. 'driver' gates who can take airport pickups. */
export type Role = "driver" | "cook" | "host" | "coordinator";
export const ROLES: { slug: Role; label: string; emoji: string }[] = [
  { slug: "driver", label: "Driver", emoji: "🚗" },
  { slug: "cook", label: "Cook", emoji: "🍲" },
  { slug: "host", label: "Host", emoji: "🏠" },
  { slug: "coordinator", label: "Coordinator", emoji: "📋" },
];

/** Public projection of a user — never includes pin_hash. */
export type PublicUser = Omit<User, "pin_hash">;

export interface Plan {
  id: string;
  title: string;
  description: string | null;
  category: PlanCategory;
  date: string; // YYYY-MM-DD
  start_time: string | null; // HH:mm
  location: string | null;
  anyone_can_join: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface PlanAttendee {
  id: string;
  plan_id: string;
  user_id: string;
  added_by: string;
  created_at: string;
}

export interface TravelGroup {
  id: string;
  title: string;
  status: TravelStatus;
  accommodation: string | null;
  luggage_notes: string | null;
  general_notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface FlightLeg {
  id: string;
  travel_group_id: string;
  leg_order: number;
  provider: string | null;
  provider_flight_id: string | null;
  flight_number: string;
  airline_code: string | null;
  airline_name: string | null;
  origin_airport: string;
  origin_city: string | null;
  destination_airport: string;
  destination_city: string | null;
  scheduled_departure: string | null;
  estimated_departure: string | null;
  actual_departure: string | null;
  scheduled_arrival: string | null;
  estimated_arrival: string | null;
  actual_arrival: string | null;
  terminal_departure: string | null;
  gate_departure: string | null;
  terminal_arrival: string | null;
  gate_arrival: string | null;
  aircraft_type: string | null;
  aircraft_type_code: string | null;
  aircraft_registration: string | null;
  status: FlightStatus;
  progress: number | null; // 0..1
  /** Where `progress` came from: live radar (OpenSky) vs a time estimate. */
  progress_source: "live" | "estimated" | null;
  delay_minutes: number | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Pickup {
  id: string;
  travel_group_id: string;
  flight_leg_id: string | null;
  requested: boolean;
  driver_user_id: string | null;
  /** Driver has set off for the airport. */
  driver_en_route: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShoppingItem {
  id: string;
  item: string;
  quantity: number;
  category: string;
  notes: string | null;
  created_by: string;
  claimed_by: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  due_date: string | null;
  due_time: string | null;
  created_by: string;
  assigned_to: string | null;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportantInfo {
  id: string;
  category: string;
  title: string;
  content: string;
  sort_order: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Place {
  id: string;
  name: string;
  address: string | null;
  notes: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string | null;
  is_pinned: boolean;
  starts_at: string | null;
  expires_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export type ActivityType =
  | "profile_created"
  | "plan_created"
  | "plan_edited"
  | "plan_joined"
  | "plan_left"
  | "flight_added"
  | "flight_status"
  | "pickup_requested"
  | "pickup_claimed"
  | "pickup_released"
  | "shopping_added"
  | "shopping_claimed"
  | "shopping_completed"
  | "task_added"
  | "task_claimed"
  | "task_completed"
  | "announcement_added"
  | "photo_added";

export interface Activity {
  id: string;
  actor_user_id: string;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Poll {
  id: string;
  question: string;
  closed: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PollOption {
  id: string;
  poll_id: string;
  label: string;
  sort_order: number;
}

export interface PollVote {
  id: string;
  poll_id: string;
  option_id: string;
  user_id: string;
  created_at: string;
}

export interface AppSettings {
  id: string;
  app_title: string;
  wedding_date: string;
  wedding_url: string;
  updated_at: string;
}

export interface Photo {
  id: string;
  storage_path: string;
  caption: string | null;
  content_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}
