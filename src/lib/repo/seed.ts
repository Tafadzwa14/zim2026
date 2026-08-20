import type {
  Activity,
  Announcement,
  AppSettings,
  FlightLeg,
  ImportantInfo,
  Pickup,
  Place,
  Plan,
  PlanAttendee,
  Poll,
  PollOption,
  PollVote,
  ShoppingItem,
  Task,
  TravelGroup,
  User,
} from "@/lib/types";

export interface SeedData {
  settings: AppSettings;
  users: User[];
  plans: Plan[];
  planAttendees: PlanAttendee[];
  travel: TravelGroup[];
  members: { travel_group_id: string; user_id: string }[];
  legs: FlightLeg[];
  pickups: Pickup[];
  shopping: ShoppingItem[];
  tasks: Task[];
  info: ImportantInfo[];
  places: Place[];
  announcements: Announcement[];
  activity: Activity[];
  polls: Poll[];
  pollOptions: PollOption[];
  pollVotes: PollVote[];
}

const nowIso = () => new Date().toISOString();

/**
 * Build the demo dataset for memory mode (used only when Supabase isn't
 * configured). The demo family and its content have been removed, so this is
 * an empty app apart from the settings row — real people are provisioned as
 * pending identities and claim themselves in the app.
 */
export function buildSeed(): SeedData {
  const settings: AppSettings = {
    id: "singleton",
    app_title: "Zim 2026",
    wedding_date: "2026-09-12",
    wedding_url: "https://becoming.thechiris.com",
    updated_at: nowIso(),
  };

  return {
    settings,
    users: [],
    plans: [],
    planAttendees: [],
    travel: [],
    members: [],
    legs: [],
    pickups: [],
    shopping: [],
    tasks: [],
    info: [],
    places: [],
    announcements: [],
    activity: [],
    polls: [],
    pollOptions: [],
    pollVotes: [],
  };
}
