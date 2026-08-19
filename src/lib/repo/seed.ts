import type {
  Activity,
  Announcement,
  AppSettings,
  FlightLeg,
  ImportantInfo,
  Pickup,
  Plan,
  PlanAttendee,
  ShoppingItem,
  Task,
  TravelGroup,
  User,
} from "@/lib/types";
import { progressFromTimes, tripTodayISO } from "@/lib/format";

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
  announcements: Announcement[];
  activity: Activity[];
}

const uid = () => globalThis.crypto.randomUUID();
const nowIso = () => new Date().toISOString();

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Build a fresh demo dataset. Flight facts here are clearly demo data. */
export function buildSeed(): SeedData {
  const now = new Date();
  const today = tripTodayISO(now);
  const at = (mins: number) => new Date(now.getTime() + mins * 60_000).toISOString();
  const harare = (dateStr: string, time: string) => `${dateStr}T${time}:00+02:00`;

  // Stable ids (username) so a demo session survives a dev-server restart.
  const U = (
    name: string,
    username: string,
    emoji: string,
    status: User["status"],
    is_admin = false
  ): User => ({
    id: username,
    name,
    username,
    emoji,
    pin_hash: "SEED",
    is_admin,
    status,
    created_at: nowIso(),
    updated_at: nowIso(),
  });

  const taffie = U("Taffie", "taffie", "🏎️", "here", true);
  const tapiwa = U("Tapiwa", "tapiwa", "😎", "here");
  const zoe = U("Zoe", "zoe", "🦋", "here");
  const tatenda = U("Tatenda", "tatenda", "🦁", "here");
  const mai = U("Mai", "mai", "🌼", "here");
  const baba = U("Baba", "baba", "🐘", "here");
  const chipo = U("Chipo", "chipo", "🦒", "here");
  const farai = U("Farai", "farai", "⚽", "here");
  const pauline = U("Pauline", "pauline", "🌸", "travelling");
  const lloyd = U("Lloyd", "lloyd", "🕶️", "upcoming");
  const ruth = U("Grandma Ruth", "ruth", "👵", "upcoming");
  const users = [taffie, tapiwa, zoe, tatenda, mai, baba, chipo, farai, pauline, lloyd, ruth];

  // --- travel + flights ---
  const travel: TravelGroup[] = [];
  const members: SeedData["members"] = [];
  const legs: FlightLeg[] = [];
  const pickups: Pickup[] = [];

  const leg = (partial: Partial<FlightLeg> & { travel_group_id: string; flight_number: string; origin_airport: string; destination_airport: string }): FlightLeg => ({
    id: uid(),
    leg_order: 0,
    provider: "demo",
    provider_flight_id: null,
    airline_code: null,
    airline_name: null,
    origin_city: null,
    destination_city: null,
    scheduled_departure: null,
    estimated_departure: null,
    actual_departure: null,
    scheduled_arrival: null,
    estimated_arrival: null,
    actual_arrival: null,
    terminal_departure: null,
    gate_departure: null,
    terminal_arrival: null,
    gate_arrival: null,
    aircraft_type: null,
    aircraft_type_code: null,
    aircraft_registration: null,
    status: "scheduled",
    progress: 0,
    delay_minutes: 0,
    last_synced_at: nowIso(),
    created_at: nowIso(),
    updated_at: nowIso(),
    ...partial,
  });

  // Pauline — EK713 in the air right now (demo), arriving today.
  const tg1 = { id: uid(), title: "Pauline", status: "travelling" as const, accommodation: null, luggage_notes: null, general_notes: "Landing this evening", created_by: pauline.id, created_at: nowIso(), updated_at: nowIso() };
  travel.push(tg1);
  members.push({ travel_group_id: tg1.id, user_id: pauline.id });
  const dep1 = at(-175);
  const arr1 = at(50);
  const leg1 = leg({
    travel_group_id: tg1.id, flight_number: "EK713", airline_code: "EK", airline_name: "Emirates",
    origin_airport: "DXB", origin_city: "Dubai", destination_airport: "HRE", destination_city: "Harare",
    scheduled_departure: dep1, scheduled_arrival: arr1, estimated_arrival: at(54),
    terminal_departure: "3", aircraft_type: "Boeing 777-300ER", aircraft_type_code: "B77W",
    aircraft_registration: "A6-ENV", status: "air", progress: progressFromTimes(dep1, arr1, now), delay_minutes: 4,
  });
  legs.push(leg1);
  pickups.push({ id: uid(), travel_group_id: tg1.id, flight_leg_id: leg1.id, requested: true, driver_user_id: tatenda.id, notes: null, created_at: nowIso(), updated_at: nowIso() });

  // Taffie & Tapiwa — already arrived.
  const tg2 = { id: uid(), title: "Taffie & Tapiwa", status: "arrived" as const, accommodation: null, luggage_notes: null, general_notes: null, created_by: taffie.id, created_at: nowIso(), updated_at: nowIso() };
  travel.push(tg2);
  members.push({ travel_group_id: tg2.id, user_id: taffie.id }, { travel_group_id: tg2.id, user_id: tapiwa.id });
  legs.push(leg({
    travel_group_id: tg2.id, flight_number: "EK713", airline_code: "EK", airline_name: "Emirates",
    origin_airport: "DXB", origin_city: "Dubai", destination_airport: "HRE", destination_city: "Harare",
    scheduled_departure: at(-60 * 96), scheduled_arrival: at(-60 * 92), aircraft_type: "Boeing 777-300ER",
    aircraft_type_code: "B77W", status: "landed", progress: 1,
  }));

  // Lloyd — upcoming.
  const tg3 = { id: uid(), title: "Lloyd", status: "upcoming" as const, accommodation: null, luggage_notes: null, general_notes: null, created_by: lloyd.id, created_at: nowIso(), updated_at: nowIso() };
  travel.push(tg3);
  members.push({ travel_group_id: tg3.id, user_id: lloyd.id });
  const leg3 = leg({
    travel_group_id: tg3.id, flight_number: "QR1367", airline_code: "QR", airline_name: "Qatar Airways",
    origin_airport: "LHR", origin_city: "London", destination_airport: "HRE", destination_city: "Harare",
    scheduled_departure: harare(addDays(today, 3), "08:20"), scheduled_arrival: harare(addDays(today, 3), "21:40"),
    aircraft_type: "Boeing 787-8", aircraft_type_code: "B788", status: "scheduled", progress: 0,
  });
  legs.push(leg3);
  pickups.push({ id: uid(), travel_group_id: tg3.id, flight_leg_id: leg3.id, requested: true, driver_user_id: null, notes: null, created_at: nowIso(), updated_at: nowIso() });

  // Bridesmaids — upcoming.
  const tg4 = { id: uid(), title: "Bridesmaids ×3", status: "upcoming" as const, accommodation: null, luggage_notes: null, general_notes: "Chipo, Zoe + a friend", created_by: zoe.id, created_at: nowIso(), updated_at: nowIso() };
  travel.push(tg4);
  members.push({ travel_group_id: tg4.id, user_id: zoe.id });
  legs.push(leg({
    travel_group_id: tg4.id, flight_number: "SA40", airline_code: "SA", airline_name: "South African",
    origin_airport: "JNB", origin_city: "Johannesburg", destination_airport: "HRE", destination_city: "Harare",
    scheduled_departure: harare(addDays(today, 12), "14:00"), scheduled_arrival: harare(addDays(today, 12), "15:35"),
    aircraft_type: "Airbus A320", aircraft_type_code: "A320", status: "scheduled", progress: 0,
  }));

  // --- plans ---
  const plan = (
    title: string, category: Plan["category"], date: string, start_time: string | null,
    location: string | null, anyone: boolean, created_by: string
  ): Plan => ({
    id: uid(), title, description: null, category, date, start_time, location,
    anyone_can_join: anyone, created_by, created_at: nowIso(), updated_at: nowIso(),
  });
  const dinner = plan("Big Family Dinner", "dinner", today, "19:00", "Gogo's place", true, mai.id);
  const shop = plan("Wedding shopping", "shopping", addDays(today, 1), "10:00", "Sam Levy Village", true, taffie.id);
  const tailor = plan("Tailor appointment", "wedding", addDays(today, 1), "14:00", "Borrowdale", false, zoe.id);
  const braai = plan("Braai at the house", "social", addDays(today, 4), "13:00", "Home", true, tatenda.id);
  const plans = [dinner, shop, tailor, braai];
  const A = (plan_id: string, user_id: string, added_by: string): PlanAttendee => ({ id: uid(), plan_id, user_id, added_by, created_at: nowIso() });
  const planAttendees = [
    A(dinner.id, mai.id, mai.id), A(dinner.id, taffie.id, mai.id), A(dinner.id, tapiwa.id, mai.id),
    A(shop.id, taffie.id, taffie.id), A(shop.id, zoe.id, taffie.id),
    A(tailor.id, zoe.id, zoe.id), A(tailor.id, tapiwa.id, zoe.id),
    A(braai.id, tatenda.id, tatenda.id), A(braai.id, farai.id, tatenda.id),
  ];

  // --- shopping + tasks ---
  const S = (item: string, quantity: number, category: string, created_by: string, claimed_by: string | null, completed: boolean): ShoppingItem => ({
    id: uid(), item, quantity, category, notes: null, created_by, claimed_by,
    completed, completed_at: completed ? nowIso() : null, created_at: nowIso(), updated_at: nowIso(),
  });
  const shopping = [
    S("Coke", 4, "Groceries", baba.id, null, false),
    S("Beef", 3, "Groceries", mai.id, null, false),
    S("Ice", 5, "Groceries", zoe.id, zoe.id, true),
    S("Extra chairs", 10, "House", tatenda.id, null, false),
    S("Flowers for tables", 6, "Wedding", zoe.id, zoe.id, false),
  ];
  const T = (title: string, due_date: string | null, created_by: string, assigned_to: string | null, completed: boolean): Task => ({
    id: uid(), title, notes: null, due_date, due_time: null, created_by, assigned_to,
    completed, completed_at: completed ? nowIso() : null, created_at: nowIso(), updated_at: nowIso(),
  });
  const tasks = [
    T("Pick up drinks", addDays(today, 1), taffie.id, null, false),
    T("Collect cake", addDays(today, 2), mai.id, tapiwa.id, true),
    T("Get extra chairs", null, tatenda.id, null, false),
    T("Buy ice", today, taffie.id, taffie.id, false),
  ];

  // --- info + announcements + activity ---
  const I = (category: string, title: string, content: string, sort_order: number): ImportantInfo => ({
    id: uid(), category, title, content, sort_order, created_by: taffie.id, updated_by: taffie.id,
    created_at: nowIso(), updated_at: nowIso(),
  });
  const info = [
    I("Emergency", "Ambulance", "994", 0),
    I("Emergency", "Police", "995", 1),
    I("Emergency", "Family contact — Baba", "+263 77 234 5566", 2),
    I("Home / Base", "Address", "12 Fairway Close, Borrowdale", 0),
    I("Home / Base", "Wi-Fi", "ZimHouse2026", 1),
    I("Home / Base", "Wi-Fi password", "welcomehome", 2),
    I("Wedding", "Date", "Sat 12 September", 0),
    I("Wedding", "Ceremony", "11:00 AM", 1),
    I("Wedding", "Dress code", "Formal / traditional", 2),
    I("Transport", "Driver — Farai", "+263 71 998 7744", 0),
  ];
  const announcements: Announcement[] = [
    { id: uid(), title: "Tailor coming tomorrow at 10 AM", content: "Final fittings at the house — be ready.", is_pinned: true, starts_at: null, expires_at: null, created_by: taffie.id, created_at: nowIso(), updated_at: nowIso() },
  ];
  const act = (actor: string, type: string, text: string, minsAgo: number): Activity => ({
    id: uid(), actor_user_id: actor, type, entity_type: null, entity_id: null,
    metadata: { text }, created_at: new Date(now.getTime() - minsAgo * 60_000).toISOString(),
  });
  const activity = [
    act(tapiwa.id, "flight_added", "added flight EK713", 20),
    act(pauline.id, "plan_joined", "joined Big Family Dinner", 40),
    act(tatenda.id, "pickup_claimed", "volunteered for Pauline’s airport pickup", 65),
    act(zoe.id, "shopping_added", "added Ice ×5", 180),
    act(tapiwa.id, "task_completed", "collected the cake", 320),
  ];

  const settings: AppSettings = {
    id: "singleton",
    app_title: "Zim 2026",
    wedding_date: "2026-09-12",
    wedding_url: "https://example.com/wedding",
    updated_at: nowIso(),
  };

  return { settings, users, plans, planAttendees, travel, members, legs, pickups, shopping, tasks, info, announcements, activity };
}
