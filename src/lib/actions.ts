"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRepo } from "@/lib/repo";
import { isItineraryParsingEnabled } from "@/lib/env";
import { parseItineraryPdf } from "@/lib/itinerary";
import type { NewLegInput } from "@/lib/repo/types";
import {
  clearSession,
  getCurrentUser,
  hashPin,
  PENDING_PIN,
  requireAdmin,
  requireUser,
  setSession,
  verifyPin,
} from "@/lib/identity";
import { estimateProgress, getFlightStatus, searchFlight } from "@/lib/flights";
import type { PlanCategory } from "@/lib/types";

export type ActionResult<T = unknown> =
  | ({ ok: true; message?: string } & T)
  | { ok: false; message: string };

function ok<T extends object>(data?: T, message?: string): ActionResult<T> {
  return { ok: true, message, ...(data ?? ({} as T)) };
}
function fail(message: string): ActionResult<never> {
  return { ok: false, message };
}
function refresh() {
  revalidatePath("/", "layout");
}
async function actorName(id: string | null): Promise<string> {
  if (!id) return "Someone";
  const u = await getRepo().getUser(id);
  return u?.name ?? "Someone";
}

// ============================ identity ============================
// New people don't self-register. An admin provisions each identity ahead of
// time (name + username), and the person claims it here by picking themselves,
// choosing an emoji and setting a PIN.
const claimSchema = z.object({
  userId: z.string().uuid(),
  emoji: z.string().trim().min(1).max(8),
  pin: z.string().regex(/^\d{4}$/, "PIN must be 4 digits"),
});

export async function claimIdentity(input: unknown): Promise<ActionResult> {
  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Pick your name, an emoji and a 4-digit PIN");
  const { userId, emoji, pin } = parsed.data;
  const repo = getRepo();
  const user = await repo.claimUser(userId, { emoji, pinHash: hashPin(pin) });
  if (!user) return fail("That identity has already been set up — use Reclaim identity instead.");
  await setSession(user.id);
  await repo.addActivity(user.id, "profile_created", "joined Zim 2026");
  refresh();
  return ok({}, `Welcome, ${user.name}!`);
}

export async function reclaimIdentity(input: unknown): Promise<ActionResult> {
  const schema = z.object({ username: z.string().trim().toLowerCase(), pin: z.string().regex(/^\d{4}$/) });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("Enter your username and 4-digit PIN");
  const repo = getRepo();
  const row = await repo.getUserWithPin(parsed.data.username);
  if (!row || !verifyPin(parsed.data.pin, row.pin_hash)) return fail("Username or PIN is incorrect");
  await setSession(row.id);
  refresh();
  return ok();
}

/** Dev-only identity switch (memory repo), to test permissions and claiming. */
export async function switchUser(userId: string): Promise<ActionResult> {
  const repo = getRepo();
  if (repo.kind !== "memory") return fail("Not available");
  const u = await repo.getUser(userId);
  if (!u) return fail("No such user");
  await setSession(userId);
  refresh();
  return ok({}, `Now viewing as ${u.name}`);
}

export async function signOut(): Promise<ActionResult> {
  await clearSession();
  refresh();
  return ok();
}

// ============================ plans ============================
export async function createPlan(input: {
  title: string; category: PlanCategory; date: string; start_time?: string | null;
  location?: string | null; notes?: string | null; anyone_can_join: boolean; attendees: string[];
}): Promise<ActionResult<{ id: string }>> {
  const me = await requireUser();
  const title = input.title?.trim();
  if (!title) return fail("Give the plan a title");
  const repo = getRepo();
  const plan = await repo.createPlan({
    title, description: input.notes ?? null, category: input.category, date: input.date,
    start_time: input.start_time || null, location: input.location?.trim() || null,
    anyone_can_join: input.anyone_can_join, created_by: me.id,
    attendees: [...new Set([me.id, ...input.attendees])],
  });
  await repo.addActivity(me.id, "plan_created", `created ${title}`, { type: "plan", id: plan.id });
  refresh();
  return ok({ id: plan.id }, "Plan created");
}

export async function joinPlan(planId: string): Promise<ActionResult> {
  const me = await requireUser();
  const repo = getRepo();
  const plan = await repo.getPlan(planId);
  if (!plan) return fail("Plan not found");
  await repo.joinPlan(planId, me.id, me.id);
  await repo.addActivity(me.id, "plan_joined", `joined ${plan.title}`, { type: "plan", id: planId });
  refresh();
  return ok({}, "You're going!");
}
export async function leavePlan(planId: string): Promise<ActionResult> {
  const me = await requireUser();
  const repo = getRepo();
  const plan = await repo.getPlan(planId);
  await repo.leavePlan(planId, me.id);
  if (plan) await repo.addActivity(me.id, "plan_left", `left ${plan.title}`, { type: "plan", id: planId });
  refresh();
  return ok({}, "Left the plan");
}
export async function addAttendee(planId: string, userId: string): Promise<ActionResult> {
  const me = await requireUser();
  const repo = getRepo();
  const plan = await repo.getPlan(planId);
  if (!plan) return fail("Plan not found");
  if (plan.created_by !== me.id && !me.is_admin) return fail("Only the creator can add people");
  await repo.joinPlan(planId, userId, me.id);
  refresh();
  return ok();
}
export async function removeAttendee(planId: string, userId: string): Promise<ActionResult> {
  const me = await requireUser();
  const repo = getRepo();
  const plan = await repo.getPlan(planId);
  if (!plan) return fail("Plan not found");
  if (plan.created_by !== me.id && !me.is_admin) return fail("Only the creator can edit this");
  await repo.leavePlan(planId, userId);
  refresh();
  return ok();
}
export async function deletePlan(planId: string): Promise<ActionResult> {
  const me = await requireUser();
  const repo = getRepo();
  const plan = await repo.getPlan(planId);
  if (!plan) return fail("Plan not found");
  if (plan.created_by !== me.id && !me.is_admin) return fail("Only the creator or an admin can delete this");
  await repo.deletePlan(planId);
  refresh();
  return ok({}, "Plan deleted");
}

// ============================ travel + flights ============================
export async function searchFlightAction(flightNumber: string, date: string): Promise<ActionResult<{ results: import("@/lib/flights").FlightSearchResult[] }>> {
  await requireUser();
  const num = (flightNumber || "").trim().toUpperCase();
  if (!num || !date) return fail("Enter a flight number and date");
  try {
    const results = await searchFlight(num, date);
    if (!results.length) return fail("Flight not found. Check the number and date.");
    return ok({ results });
  } catch {
    return fail("Live flight information is temporarily unavailable");
  }
}

export async function createTravel(input: {
  travellers: string[]; pickup: boolean; notes?: string | null; legs: NewLegInput[]; title?: string;
}): Promise<ActionResult<{ id: string }>> {
  const me = await requireUser();
  const repo = getRepo();
  if (!input.legs?.length) return fail("Add at least one flight");
  const travellers = [...new Set(input.travellers.length ? input.travellers : [me.id])];
  const names = await Promise.all(travellers.map((id) => repo.getUser(id).then((u) => u?.name ?? "")));
  const title = input.title?.trim() || names.filter(Boolean).join(" & ") || "Travel";
  const group = await repo.createTravel({ title, travellers, created_by: me.id, pickup: input.pickup, notes: input.notes ?? null, legs: input.legs });
  await repo.addActivity(me.id, "flight_added", `added flight ${input.legs[0].flight_number}`, { type: "travel", id: group.id });
  if (input.pickup) await repo.addActivity(me.id, "pickup_requested", "requested an airport pickup", { type: "travel", id: group.id });
  refresh();
  return ok({ id: group.id }, "Travel added");
}

/** Read an uploaded itinerary PDF into a list of flight legs to prefill the form. */
export async function parseItinerary(formData: FormData): Promise<ActionResult<{ legs: NewLegInput[]; passengers: string[]; booking_reference: string | null }>> {
  await requireUser();
  if (!isItineraryParsingEnabled()) return fail("Itinerary upload isn't set up. Add an OpenAI key to enable it.");
  const file = formData.get("file");
  if (!(file instanceof File)) return fail("Choose a PDF to upload");
  if (file.type !== "application/pdf") return fail("That's not a PDF — export your itinerary as a PDF and try again");
  if (file.size > 15 * 1024 * 1024) return fail("That PDF is too large (max 15 MB)");
  let extracted;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    extracted = await parseItineraryPdf(bytes, file.name);
  } catch {
    return fail("Couldn't read that itinerary — check it's a real flight PDF, or add the flight by number instead");
  }
  const legs: NewLegInput[] = extracted.legs
    .filter((l) => l.flight_number && l.origin_airport && l.destination_airport)
    .map((l, i) => ({
      leg_order: i,
      flight_number: l.flight_number,
      airline_code: l.airline_code,
      airline_name: l.airline_name,
      origin_airport: l.origin_airport,
      origin_city: l.origin_city,
      destination_airport: l.destination_airport,
      destination_city: l.destination_city,
      scheduled_departure: l.scheduled_departure,
      scheduled_arrival: l.scheduled_arrival,
      terminal_departure: l.terminal_departure,
      aircraft_type: l.aircraft_type,
      status: "scheduled",
      provider: "itinerary",
    }));
  if (!legs.length) return fail("No flights found in that PDF");
  return ok({ legs, passengers: extracted.passengers ?? [], booking_reference: extracted.booking_reference ?? null }, `Found ${legs.length} flight${legs.length > 1 ? "s" : ""}`);
}

/** Admin: cycle a flight leg's status (spec: correct flight info). */
export async function cycleFlightStatus(travelId: string, legId: string): Promise<ActionResult> {
  await requireAdmin();
  const repo = getRepo();
  const tg = await repo.getTravel(travelId);
  const leg = tg?.legs.find((l) => l.id === legId);
  if (!leg) return fail("Flight not found");
  const order = ["scheduled", "boarding", "air", "landed"] as const;
  const next = order[(order.indexOf(leg.status as (typeof order)[number]) + 1) % order.length];
  await repo.setLegStatus(legId, next, next === "air" ? 0.5 : next === "landed" ? 1 : 0);
  if (next === "landed") {
    await repo.setTravelStatus(travelId, "arrived");
    for (const m of tg!.members) await repo.setUserStatus(m.id, "here");
  } else if (next === "air") {
    await repo.setTravelStatus(travelId, "travelling");
  } else {
    await repo.setTravelStatus(travelId, "upcoming");
  }
  refresh();
  return ok({}, `Status → ${next}`);
}

/** Pull live status from the flight provider and update the legs (spec sections 19, 25). */
export async function refreshFlight(travelId: string): Promise<ActionResult> {
  await requireUser();
  const repo = getRepo();
  const tg = await repo.getTravel(travelId);
  if (!tg) return fail("Flight not found");
  let landedAll = tg.legs.length > 0;
  let anyAir = false;
  try {
    for (const leg of tg.legs) {
      const date = (leg.scheduled_departure ?? "").slice(0, 10);
      const status = date ? await getFlightStatus(leg.flight_number, date, leg.status === "air") : null;
      if (!status) {
        if (leg.status !== "landed") landedAll = false;
        if (leg.status === "air") anyAir = true;
        continue;
      }
      const dep = status.departure.actualTime ?? status.departure.estimatedTime ?? status.departure.scheduledTime ?? leg.scheduled_departure;
      const arr = status.arrival.estimatedTime ?? status.arrival.scheduledTime ?? leg.scheduled_arrival;
      const prog = status.status === "landed" ? 1 : status.status === "air" ? estimateProgress(dep, arr) : 0;
      await repo.syncLeg(leg.id, {
        status: status.status,
        airline_name: status.airlineName ?? leg.airline_name,
        estimated_departure: status.departure.estimatedTime,
        actual_departure: status.departure.actualTime,
        estimated_arrival: status.arrival.estimatedTime,
        actual_arrival: status.arrival.actualTime,
        terminal_departure: status.departure.terminal ?? leg.terminal_departure,
        aircraft_type: status.aircraftType ?? leg.aircraft_type,
        aircraft_type_code: status.aircraftTypeCode ?? leg.aircraft_type_code,
        aircraft_registration: status.aircraftRegistration ?? leg.aircraft_registration,
        delay_minutes: status.delayMinutes ?? leg.delay_minutes,
        progress: prog,
      });
      if (status.status === "air") anyAir = true;
      if (status.status !== "landed") landedAll = false;
    }
  } catch {
    return fail("Live flight information is temporarily unavailable");
  }
  if (landedAll) {
    await repo.setTravelStatus(travelId, "arrived");
    for (const m of tg.members) await repo.setUserStatus(m.id, "here");
  } else if (anyAir) {
    await repo.setTravelStatus(travelId, "travelling");
    for (const m of tg.members) await repo.setUserStatus(m.id, "travelling");
  }
  refresh();
  return ok({}, "Flight updated");
}

// ============================ pickups ============================
export async function claimPickup(travelGroupId: string): Promise<ActionResult> {
  const me = await requireUser();
  if (!me.is_admin && !me.roles.includes("driver")) return fail("Only a driver can take a pickup. Ask an admin to give you the driver role.");
  const repo = getRepo();
  const res = await repo.claimPickup(travelGroupId, me.id);
  if (!res.ok) return fail(`Looks like ${await actorName(res.claimedBy)} just claimed this`);
  const tg = await repo.getTravel(travelGroupId);
  await repo.addActivity(me.id, "pickup_claimed", `claimed the airport pickup for ${tg?.title ?? "a flight"}`, { type: "travel", id: travelGroupId });
  refresh();
  return ok({}, "Pickup claimed — thank you!");
}
export async function releasePickup(travelGroupId: string): Promise<ActionResult> {
  const me = await requireUser();
  const repo = getRepo();
  const tg = await repo.getTravel(travelGroupId);
  const isDriver = tg?.pickup?.driver_user_id === me.id;
  if (!isDriver && !me.is_admin) return fail("Only the driver or an admin can do this");
  await repo.releasePickup(travelGroupId);
  await repo.addActivity(me.id, "pickup_released", `${isDriver ? "released" : "reopened"} the pickup for ${tg?.title ?? "a flight"}`, { type: "travel", id: travelGroupId });
  refresh();
  return ok({}, isDriver ? "Pickup released" : "Pickup reopened");
}

// ============================ shopping ============================
export async function addShopping(input: { item: string; quantity: number; category: string }): Promise<ActionResult> {
  const me = await requireUser();
  const item = input.item?.trim();
  if (!item) return fail("Add an item");
  const repo = getRepo();
  await repo.addShopping({ item, quantity: Math.max(1, Math.floor(input.quantity || 1)), category: input.category, created_by: me.id });
  await repo.addActivity(me.id, "shopping_added", `added ${item} ×${Math.max(1, input.quantity || 1)}`);
  refresh();
  return ok({}, "Added to the list");
}
export async function claimShopping(id: string): Promise<ActionResult> {
  const me = await requireUser();
  const repo = getRepo();
  const res = await repo.claimShopping(id, me.id);
  if (!res.ok) return fail(`Looks like ${await actorName(res.claimedBy)} just claimed this`);
  refresh();
  return ok({}, "You've got it");
}
export async function unclaimShopping(id: string): Promise<ActionResult> {
  await requireUser();
  await getRepo().unclaimShopping(id);
  refresh();
  return ok();
}
export async function toggleShopping(id: string, done: boolean): Promise<ActionResult> {
  const me = await requireUser();
  const repo = getRepo();
  await repo.setShoppingDone(id, done, me.id);
  if (done) await repo.addActivity(me.id, "shopping_completed", "ticked off a shopping item");
  refresh();
  return ok();
}

// ============================ tasks ============================
export async function addTask(input: { title: string; due_date?: string | null; notes?: string | null }): Promise<ActionResult> {
  const me = await requireUser();
  const title = input.title?.trim();
  if (!title) return fail("Add a task");
  const repo = getRepo();
  await repo.addTask({ title, due_date: input.due_date || null, notes: input.notes ?? null, created_by: me.id });
  await repo.addActivity(me.id, "task_added", `added task “${title}”`);
  refresh();
  return ok({}, "Task added");
}
export async function claimTask(id: string): Promise<ActionResult> {
  const me = await requireUser();
  const repo = getRepo();
  const res = await repo.claimTask(id, me.id);
  if (!res.ok) return fail(`Looks like ${await actorName(res.claimedBy)} is already on it`);
  refresh();
  return ok({}, "You're on it");
}
export async function unclaimTask(id: string): Promise<ActionResult> {
  await requireUser();
  await getRepo().unclaimTask(id);
  refresh();
  return ok();
}
export async function toggleTask(id: string, done: boolean): Promise<ActionResult> {
  const me = await requireUser();
  const repo = getRepo();
  await repo.setTaskDone(id, done, me.id);
  if (done) await repo.addActivity(me.id, "task_completed", "completed a task");
  refresh();
  return ok();
}

// ============================ admin ============================
export async function addAnnouncement(input: { title: string; content?: string | null; is_pinned: boolean }): Promise<ActionResult> {
  const me = await requireAdmin();
  const title = input.title?.trim();
  if (!title) return fail("Add a title");
  const repo = getRepo();
  await repo.addAnnouncement({ title, content: input.content ?? null, is_pinned: input.is_pinned, created_by: me.id });
  await repo.addActivity(me.id, "announcement_added", "posted an announcement");
  refresh();
  return ok({}, "Announcement posted");
}
export async function setAnnouncementPinned(id: string, pinned: boolean): Promise<ActionResult> {
  await requireAdmin();
  await getRepo().setAnnouncementPinned(id, pinned);
  refresh();
  return ok({}, pinned ? "Pinned to Home" : "Unpinned");
}
export async function deleteAnnouncement(id: string): Promise<ActionResult> {
  await requireAdmin();
  await getRepo().deleteAnnouncement(id);
  refresh();
  return ok({}, "Announcement removed");
}
export async function setAdmin(userId: string, isAdmin: boolean): Promise<ActionResult> {
  const me = await requireAdmin();
  if (userId === me.id && !isAdmin) return fail("You can't revoke your own admin");
  await getRepo().setAdmin(userId, isAdmin);
  refresh();
  return ok({}, isAdmin ? "Admin granted" : "Admin revoked");
}
export async function updateSettings(input: { app_title?: string; wedding_date?: string; wedding_url?: string }): Promise<ActionResult> {
  await requireAdmin();
  await getRepo().updateSettings(input);
  refresh();
  return ok({}, "Settings saved");
}

// ---------------------------- admin: roster ----------------------------
const newPersonSchema = z.object({
  name: z.string().trim().min(1).max(40),
  username: z.string().trim().min(2).max(40),
  is_admin: z.boolean().optional(),
});
export async function adminAddPerson(input: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = newPersonSchema.safeParse(input);
  if (!parsed.success) return fail("Enter a name and a username (2+ characters)");
  const { name, username, is_admin } = parsed.data;
  const repo = getRepo();
  if (await repo.usernameTaken(username)) return fail("That username is taken");
  await repo.createUser({ name, username, emoji: "🙂", pinHash: PENDING_PIN, is_admin: is_admin ?? false, status: "here" });
  refresh();
  return ok({}, `${name} added — they can now claim their identity`);
}
export async function adminResetPin(userId: string): Promise<ActionResult> {
  const me = await requireAdmin();
  if (userId === me.id) return fail("You can't reset your own PIN here");
  await getRepo().resetUserPin(userId);
  refresh();
  return ok({}, "PIN reset — they can set a new one from the login screen");
}
export async function adminSetRoles(userId: string, roles: string[]): Promise<ActionResult> {
  await requireAdmin();
  const clean = [...new Set(roles.map((r) => r.trim().toLowerCase()).filter(Boolean))];
  await getRepo().setUserRoles(userId, clean);
  refresh();
  return ok({}, "Roles updated");
}
export async function adminSetLocation(userId: string, stayingAt: string): Promise<ActionResult> {
  await requireAdmin();
  const v = stayingAt.trim();
  await getRepo().setUserLocation(userId, v || null);
  refresh();
  return ok({}, "Location updated");
}
export async function adminRemovePerson(userId: string): Promise<ActionResult> {
  const me = await requireAdmin();
  if (userId === me.id) return fail("You can't remove yourself");
  await getRepo().deleteUser(userId);
  refresh();
  return ok({}, "Person removed");
}

// ---------------------------- admin: places ----------------------------
export async function adminAddPlace(input: { name: string; address?: string; notes?: string }): Promise<ActionResult> {
  const me = await requireAdmin();
  const name = input.name?.trim();
  if (!name) return fail("Add a place name");
  await getRepo().createPlace({ name, address: input.address?.trim() || null, notes: input.notes?.trim() || null, created_by: me.id });
  refresh();
  return ok({}, "Place added");
}
export async function adminUpdatePlace(id: string, patch: { name?: string; address?: string | null; notes?: string | null }): Promise<ActionResult> {
  await requireAdmin();
  await getRepo().updatePlace(id, patch);
  refresh();
  return ok({}, "Place updated");
}
export async function adminDeletePlace(id: string): Promise<ActionResult> {
  await requireAdmin();
  await getRepo().deletePlace(id);
  refresh();
  return ok({}, "Place removed");
}

// ---------------------------- admin: important info ----------------------------
export async function adminAddInfo(input: { category: string; title: string; content: string }): Promise<ActionResult> {
  const me = await requireAdmin();
  const category = input.category?.trim();
  const title = input.title?.trim();
  const content = input.content?.trim();
  if (!category || !title || !content) return fail("Category, title and content are all required");
  await getRepo().addInfo({ category, title, content, created_by: me.id });
  refresh();
  return ok({}, "Info added");
}
export async function adminUpdateInfo(id: string, patch: { category?: string; title?: string; content?: string }): Promise<ActionResult> {
  const me = await requireAdmin();
  await getRepo().updateInfo(id, patch, me.id);
  refresh();
  return ok({}, "Info updated");
}
export async function adminDeleteInfo(id: string): Promise<ActionResult> {
  await requireAdmin();
  await getRepo().deleteInfo(id);
  refresh();
  return ok({}, "Info removed");
}

// ---------------------------- admin: flights ----------------------------
const legEditSchema = z.object({
  flight_number: z.string().trim().min(2).optional(),
  airline_name: z.string().trim().optional(),
  origin_airport: z.string().trim().optional(),
  destination_airport: z.string().trim().optional(),
  scheduled_departure: z.string().trim().nullable().optional(),
  scheduled_arrival: z.string().trim().nullable().optional(),
  terminal_departure: z.string().trim().nullable().optional(),
  aircraft_type: z.string().trim().nullable().optional(),
  status: z.enum(["scheduled", "boarding", "air", "landed", "cancelled", "diverted"]).optional(),
});
export async function adminUpdateLeg(legId: string, patch: unknown): Promise<ActionResult> {
  await requireAdmin();
  const parsed = legEditSchema.safeParse(patch);
  if (!parsed.success) return fail("Check the flight details");
  const clean = Object.fromEntries(Object.entries(parsed.data).map(([k, v]) => [k, v === "" ? null : v]));
  await getRepo().syncLeg(legId, clean as Partial<import("@/lib/types").FlightLeg>);
  refresh();
  return ok({}, "Flight updated");
}

export async function whoAmI() {
  return getCurrentUser();
}
