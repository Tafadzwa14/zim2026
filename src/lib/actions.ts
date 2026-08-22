"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRepo } from "@/lib/repo";
import { isItineraryParsingEnabled, serverEnv } from "@/lib/server-env";
import { parseItineraryPdf } from "@/lib/itinerary";
import { parseItineraryPdfLocal } from "@/lib/itinerary-local";
import type { NewLegInput, Repo } from "@/lib/repo/types";
import {
  clearSession,
  getCurrentUser,
  hashClaimCode,
  hashPin,
  newClaimCode,
  PENDING_PIN,
  requireAdmin,
  requireUser,
  setSession,
  verifyPin,
} from "@/lib/identity";
import { estimateProgress, getFlightPosition, getFlightStatus, searchFlight } from "@/lib/flights";
import { routeFraction } from "@/lib/flights/geo";
import { airportZone } from "@/lib/airports";
import { dateIn } from "@/lib/format";
import { sanitiseLayout, type Surface } from "@/lib/home-layout";
import { journeyStatus, locationStatusForJourneys } from "@/lib/travel";
import type { FlightStatus, PlanCategory, UserPrefs } from "@/lib/types";

export type ActionResult<T = unknown> =
  | ({ ok: true; message?: string } & T)
  | { ok: false; message: string };

function ok<T extends object>(data?: T, message?: string): ActionResult<T> {
  return { ok: true, message, ...(data ?? ({} as T)) };
}
function fail(message: string): ActionResult<never> {
  return { ok: false, message };
}
const uuidSchema = z.string().uuid();
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Invalid date");
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const uuidList = z.array(uuidSchema).max(100);

function validId(value: unknown): value is string {
  return uuidSchema.safeParse(value).success;
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
  claimCode: z.string().trim().min(12).max(64),
});

export async function claimIdentity(input: unknown): Promise<ActionResult> {
  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Pick your name, an emoji and a 4-digit PIN");
  const { userId, emoji, pin, claimCode } = parsed.data;
  const repo = getRepo();
  const rateKey = `claim:${userId}`;
  if (!(await repo.consumeAuthAttempt(rateKey))) return fail("Too many attempts. Wait 15 minutes and try again.");
  const claimed = await repo.claimUser(userId, { emoji, pinHash: hashPin(pin), claimTokenHash: hashClaimCode(claimCode) });
  if (!claimed) return fail("That invite code is invalid, expired, or the identity has already been claimed.");
  const { user, sessionVersion } = claimed;
  await repo.clearAuthAttempts(rateKey);
  await setSession(user.id, sessionVersion);
  await repo.addActivity(user.id, "profile_created", "joined Zim 2026");
  refresh();
  return ok({}, `Welcome, ${user.name}!`);
}

export async function requestPinReset(userId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(userId);
  if (!parsed.success) return fail("Pick your name first");
  await getRepo().requestPinReset(parsed.data);
  refresh();
  return ok({}, "Asked an admin to reset your PIN — they'll sort it soon.");
}

export async function reclaimIdentity(input: unknown): Promise<ActionResult> {
  const schema = z.object({ userId: z.string().uuid(), pin: z.string().regex(/^\d{4}$/) });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail("Pick your name and enter your 4-digit PIN");
  const repo = getRepo();
  const rateKey = `login:${parsed.data.userId}`;
  if (!(await repo.consumeAuthAttempt(rateKey))) return fail("Too many attempts. Wait 15 minutes and try again.");
  const row = await repo.getUserWithPin(parsed.data.userId);
  if (!row || !verifyPin(parsed.data.pin, row.pin_hash)) return fail("Username or PIN is incorrect");
  await repo.clearAuthAttempts(rateKey);
  await setSession(row.id, row.session_version);
  refresh();
  return ok();
}

/** Dev-only identity switch (memory repo), to test permissions and claiming. */
export async function switchUser(userId: string): Promise<ActionResult> {
  const repo = getRepo();
  if (repo.kind !== "memory") return fail("Not available");
  const u = await repo.getUser(userId);
  if (!u) return fail("No such user");
  await setSession(userId, (await repo.getSessionVersion(userId)) ?? 0);
  refresh();
  return ok({}, `Now viewing as ${u.name}`);
}

export async function signOut(): Promise<ActionResult> {
  await clearSession();
  refresh();
  return ok();
}

// ============================ plans ============================
const createPlanSchema = z.object({
  title: z.string().trim().min(1).max(120),
  category: z.enum(["travel", "family", "wedding", "dinner", "shopping", "transport", "social", "important"]),
  date: dateSchema,
  start_time: z.string().regex(/^\d{2}:\d{2}(?::\d{2})?$/).nullable().optional(),
  location: optionalText(200),
  notes: optionalText(2000),
  anyone_can_join: z.boolean(),
  attendees: uuidList,
});
export async function createPlan(input: unknown): Promise<ActionResult<{ id: string }>> {
  const me = await requireUser();
  const parsed = createPlanSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the plan details");
  const clean = parsed.data;
  const title = clean.title;
  const repo = getRepo();
  const plan = await repo.createPlan({
    title, description: clean.notes ?? null, category: clean.category as PlanCategory, date: clean.date,
    start_time: clean.start_time || null, location: clean.location || null,
    anyone_can_join: clean.anyone_can_join, created_by: me.id,
    attendees: [...new Set([me.id, ...clean.attendees])],
  });
  await repo.addActivity(me.id, "plan_created", `created ${title}`, { type: "plan", id: plan.id });
  refresh();
  return ok({ id: plan.id }, "Plan created");
}

export async function joinPlan(planId: string): Promise<ActionResult> {
  if (!validId(planId)) return fail("Invalid plan");
  const me = await requireUser();
  const repo = getRepo();
  const plan = await repo.getPlan(planId);
  if (!plan) return fail("Plan not found");
  if (!plan.anyone_can_join && plan.created_by !== me.id && !me.is_admin) return fail("This plan is invite-only");
  await repo.joinPlan(planId, me.id, me.id);
  await repo.addActivity(me.id, "plan_joined", `joined ${plan.title}`, { type: "plan", id: planId });
  refresh();
  return ok({}, "You're going!");
}
export async function leavePlan(planId: string): Promise<ActionResult> {
  if (!validId(planId)) return fail("Invalid plan");
  const me = await requireUser();
  const repo = getRepo();
  const plan = await repo.getPlan(planId);
  await repo.leavePlan(planId, me.id);
  if (plan) await repo.addActivity(me.id, "plan_left", `left ${plan.title}`, { type: "plan", id: planId });
  refresh();
  return ok({}, "Left the plan");
}
export async function addAttendee(planId: string, userId: string): Promise<ActionResult> {
  if (!validId(planId) || !validId(userId)) return fail("Invalid person or plan");
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
  if (!validId(planId) || !validId(userId)) return fail("Invalid person or plan");
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
  if (!validId(planId)) return fail("Invalid plan");
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
/** Recompute a person's location from every journey instead of letting the
 * last-refreshed trip overwrite another active trip. */
async function syncUserTravelStatuses(repo: Repo, userIds: string[]): Promise<void> {
  const travel = await repo.listTravel();
  for (const userId of new Set(userIds)) {
    const mine = travel.filter((t) => t.members.some((m) => m.id === userId));
    const status = locationStatusForJourneys(mine.map((trip) => trip.status));
    await repo.setUserStatus(userId, status);
  }
}

export async function searchFlightAction(flightNumber: string, date: string): Promise<ActionResult<{ results: import("@/lib/flights").FlightSearchResult[] }>> {
  await requireUser();
  const num = (flightNumber || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{2,3}\s?\d{1,4}[A-Z]?$/.test(num) || !dateSchema.safeParse(date).success) return fail("Enter a valid flight number and date");
  try {
    const results = await searchFlight(num, date);
    if (!results.length) return fail("Flight not found. Check the number and date.");
    return ok({ results });
  } catch {
    return fail("Live flight information is temporarily unavailable");
  }
}

const isoValue = z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid flight time");
const newLegSchema = z.object({
  leg_order: z.number().int().min(0).max(50),
  flight_number: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,3}\s?\d{1,4}[A-Z]?$/).max(10),
  airline_code: optionalText(8), airline_name: optionalText(120),
  origin_airport: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  origin_city: optionalText(100),
  destination_airport: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/),
  destination_city: optionalText(100),
  scheduled_departure: isoValue.nullable().optional(), scheduled_arrival: isoValue.nullable().optional(), estimated_arrival: isoValue.nullable().optional(),
  aircraft_type: optionalText(100), aircraft_type_code: optionalText(12), aircraft_registration: optionalText(20), terminal_departure: optionalText(30),
  status: z.enum(["scheduled", "boarding", "air", "landed", "cancelled", "diverted", "unknown"]).optional(),
  provider: optionalText(40), provider_flight_id: optionalText(200),
});
const createTravelSchema = z.object({
  travellers: uuidList,
  pickup: z.boolean(),
  notes: optionalText(2000),
  title: z.string().trim().max(120).optional(),
  legs: z.array(newLegSchema).min(1).max(20),
});
export async function createTravel(input: unknown): Promise<ActionResult<{ id: string }>> {
  const me = await requireUser();
  const repo = getRepo();
  const parsed = createTravelSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the travel details");
  const clean = parsed.data;
  const travellers = [...new Set(clean.travellers.length ? clean.travellers : [me.id])];
  const names = await Promise.all(travellers.map((id) => repo.getUser(id).then((u) => u?.name ?? "")));
  const title = clean.title || names.filter(Boolean).join(" & ") || "Travel";
  // Store airport codes clean: a pasted " hre" has to match HRE, or the trip
  // yields no airport run and the pickup never appears.
  const legs: NewLegInput[] = clean.legs.map((l) => ({
    ...l,
    origin_airport: l.origin_airport.trim().toUpperCase(),
    destination_airport: l.destination_airport.trim().toUpperCase(),
  }));
  if (clean.pickup && !legs.some((leg) => leg.destination_airport === "HRE")) {
    return fail("A Harare pickup needs at least one flight arriving at HRE");
  }
  const group = await repo.createTravel({ title, travellers, created_by: me.id, pickup: clean.pickup, notes: clean.notes ?? null, legs });
  await repo.addActivity(me.id, "flight_added", `added flight ${legs[0].flight_number}`, { type: "travel", id: group.id });
  if (clean.pickup) await repo.addActivity(me.id, "pickup_requested", "requested an airport pickup", { type: "travel", id: group.id });
  refresh();
  return ok({ id: group.id }, "Travel added");
}

/** Read an uploaded itinerary PDF into a list of flight legs to prefill the form. */
export async function parseItinerary(formData: FormData): Promise<ActionResult<{ legs: NewLegInput[]; passengers: string[]; booking_reference: string | null }>> {
  await requireUser();
  if (!isItineraryParsingEnabled()) return fail("Itinerary upload isn't set up.");
  const file = formData.get("file");
  if (!(file instanceof File)) return fail("Choose a PDF to upload");
  if (file.type !== "application/pdf") return fail("That's not a PDF — export your itinerary as a PDF and try again");
  if (file.size > 15 * 1024 * 1024) return fail("That PDF is too large (max 15 MB)");
  let extracted;
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const parser = serverEnv.itineraryParser;
    if (parser === "openai") {
      extracted = await parseItineraryPdf(bytes, file.name);
    } else {
      try {
        extracted = await parseItineraryPdfLocal(bytes, file.name);
      } catch (localErr) {
        if (parser !== "local-with-ai-fallback" || !serverEnv.openaiApiKey) throw localErr;
        console.info("[parseItinerary] local parser failed; trying OpenAI fallback:", localErr);
        extracted = await parseItineraryPdf(bytes, file.name);
      }
    }
  } catch (err) {
    // Log the real cause; the friendly message below never leaks the reason.
    console.error("[parseItinerary] itinerary read failed:", err);
    const status = (err as { status?: number })?.status;
    const code = (err as { code?: string })?.code;
    if (status === 401) {
      return fail("Itinerary upload isn't configured correctly — the OpenAI key was rejected. Add the flight by number instead.");
    }
    if (status === 429 || code === "insufficient_quota" || code === "rate_limit_exceeded") {
      return fail("Itinerary reading is temporarily unavailable. Add the flight by number instead, or try again later.");
    }
    // Genuine "we couldn't make sense of the document" case.
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
  if (!validId(travelId) || !validId(legId)) return fail("Invalid flight");
  await requireAdmin();
  const repo = getRepo();
  const tg = await repo.getTravel(travelId);
  if (!tg) return fail("Flight not found");
  const leg = tg.legs.find((l) => l.id === legId);
  if (!leg) return fail("Flight not found");
  const order = ["scheduled", "boarding", "air", "landed"] as const;
  const next = order[(order.indexOf(leg.status as (typeof order)[number]) + 1) % order.length];
  await repo.setLegStatus(legId, next, next === "air" ? 0.5 : next === "landed" ? 1 : 0);
  // Judge the whole journey, not the one leg: landing leg 1 of 3 must not mark
  // the trip arrived and everyone home while they're still in Sydney.
  const after = await repo.getTravel(travelId);
  const members = after?.members ?? tg.members;
  const journey = journeyStatus((after?.legs ?? []).map((l) => l.status));
  await repo.setTravelStatus(travelId, journey);
  await syncUserTravelStatuses(repo, members.map((m) => m.id));
  refresh();
  return ok({}, `Status → ${next}`);
}

/** Pull live status from the flight provider and update the legs (spec sections 19, 25). */
export async function refreshFlight(travelId: string): Promise<ActionResult> {
  if (!validId(travelId)) return fail("Invalid flight");
  await requireUser();
  const repo = getRepo();
  const tg = await repo.getTravel(travelId);
  if (!tg) return fail("Flight not found");
  // Every leg's status once this refresh is done, whether it came from the
  // provider or stayed as it was, so the journey test below sees the whole trip.
  const statuses: FlightStatus[] = [];
  try {
    for (const leg of tg.legs) {
      const date = leg.scheduled_departure ? dateIn(leg.scheduled_departure, airportZone(leg.origin_airport)) : "";
      const status = date ? await getFlightStatus(leg.flight_number, date, leg.status === "air", {
        origin: leg.origin_airport,
        destination: leg.destination_airport,
        providerFlightId: leg.provider_flight_id,
      }) : null;
      if (!status) {
        statuses.push(leg.status);
        continue;
      }
      const dep = status.departure.actualTime ?? status.departure.estimatedTime ?? status.departure.scheduledTime ?? leg.scheduled_departure;
      const arr = status.arrival.actualTime ?? status.arrival.estimatedTime ?? status.arrival.scheduledTime ?? leg.scheduled_arrival;
      let prog = status.status === "landed" ? 1 : status.status === "air" ? estimateProgress(dep, arr) : 0;
      // Prefer a live OpenSky position for the plane when airborne; fall back
      // to the time estimate when the radar can't see it (ocean/Africa gaps).
      let progressSource: import("@/lib/types").FlightLeg["progress_source"] = null;
      if (status.status === "air") {
        progressSource = "estimated";
        const pos = await getFlightPosition(leg.flight_number, date, true);
        if (pos) {
          const live = routeFraction(
            status.departure.airport || leg.origin_airport,
            status.arrival.airport || leg.destination_airport,
            pos
          );
          if (live !== null) {
            prog = live;
            progressSource = "live";
          }
        }
      }
      await repo.syncLeg(leg.id, {
        status: status.status,
        airline_name: status.airlineName ?? leg.airline_name,
        estimated_departure: status.departure.estimatedTime,
        actual_departure: status.departure.actualTime,
        estimated_arrival: status.arrival.estimatedTime,
        actual_arrival: status.arrival.actualTime,
        terminal_departure: status.departure.terminal ?? leg.terminal_departure,
        gate_departure: status.departure.gate ?? leg.gate_departure,
        terminal_arrival: status.arrival.terminal ?? leg.terminal_arrival,
        gate_arrival: status.arrival.gate ?? leg.gate_arrival,
        aircraft_type: status.aircraftType ?? leg.aircraft_type,
        aircraft_type_code: status.aircraftTypeCode ?? leg.aircraft_type_code,
        aircraft_registration: status.aircraftRegistration ?? leg.aircraft_registration,
        delay_minutes: status.delayMinutes ?? leg.delay_minutes,
        progress: prog,
        progress_source: progressSource,
      });
      statuses.push(status.status);
    }
  } catch {
    return fail("Live flight information is temporarily unavailable");
  }
  const journey = journeyStatus(statuses);
  await repo.setTravelStatus(travelId, journey);
  await syncUserTravelStatuses(repo, tg.members.map((m) => m.id));
  refresh();
  return ok({}, "Flight updated");
}

// ============================ pickups ============================
export async function claimPickup(pickupId: string): Promise<ActionResult> {
  if (!validId(pickupId)) return fail("Invalid pickup");
  const me = await requireUser();
  if (!me.is_admin && !me.roles.includes("driver")) return fail("Only a driver can take a pickup. Ask an admin to give you the driver role.");
  const repo = getRepo();
  const pickup = await repo.getPickup(pickupId);
  if (!pickup?.requested) return fail("No pickup to claim");
  const res = await repo.claimPickup(pickupId, me.id);
  if (!res.ok) return fail(`Looks like ${await actorName(res.claimedBy)} just claimed this`);
  const tg = await repo.getTravel(pickup.travel_group_id);
  await repo.addActivity(me.id, "pickup_claimed", `claimed the airport pickup for ${tg?.title ?? "a flight"}`, { type: "travel", id: pickup.travel_group_id });
  refresh();
  return ok({}, "Pickup claimed — thank you!");
}
export async function assignPickup(pickupId: string, driverUserId: string): Promise<ActionResult> {
  if (!validId(pickupId) || !validId(driverUserId)) return fail("Invalid pickup or driver");
  const me = await requireAdmin();
  const repo = getRepo();
  const target = (await repo.listUsers()).find((u) => u.id === driverUserId);
  if (!target) return fail("That person isn't here");
  if (!target.is_admin && !target.roles.includes("driver")) return fail(`${target.name} isn't a driver — give them the driver role first`);
  const pickup = await repo.getPickup(pickupId);
  if (!pickup?.requested) return fail("No pickup to assign");
  const tg = await repo.getTravel(pickup.travel_group_id);
  if (!tg) return fail("Travel not found");
  await repo.assignPickup(pickupId, driverUserId);
  await repo.addActivity(me.id, "pickup_claimed", `assigned ${target.name} to collect ${tg.title}`, { type: "travel", id: tg.id });
  refresh();
  return ok({}, `${target.name} is on pickup duty`);
}
export async function releasePickup(pickupId: string): Promise<ActionResult> {
  if (!validId(pickupId)) return fail("Invalid pickup");
  const me = await requireUser();
  const repo = getRepo();
  const pickup = await repo.getPickup(pickupId);
  if (!pickup) return fail("Pickup not found");
  const tg = await repo.getTravel(pickup.travel_group_id);
  const isDriver = pickup.driver_user_id === me.id;
  if (!isDriver && !me.is_admin) return fail("Only the driver or an admin can do this");
  await repo.releasePickup(pickupId);
  await repo.addActivity(me.id, "pickup_released", `${isDriver ? "released" : "reopened"} the pickup for ${tg?.title ?? "a flight"}`, { type: "travel", id: pickup.travel_group_id });
  refresh();
  return ok({}, isDriver ? "Pickup released" : "Pickup reopened");
}
export async function setPickupEnRoute(pickupId: string, enRoute: boolean): Promise<ActionResult> {
  if (!validId(pickupId) || typeof enRoute !== "boolean") return fail("Invalid pickup update");
  const me = await requireUser();
  const repo = getRepo();
  const pickup = await repo.getPickup(pickupId);
  if (!pickup?.requested) return fail("No pickup to update");
  const tg = await repo.getTravel(pickup.travel_group_id);
  if (!tg) return fail("Travel not found");
  const isDriver = pickup.driver_user_id === me.id;
  if (!isDriver && !me.is_admin) return fail("Only the assigned driver can do this");
  await repo.setPickupEnRoute(pickupId, enRoute);
  if (enRoute) await repo.addActivity(me.id, "pickup_claimed", `is on the way to collect ${tg.title}`, { type: "travel", id: tg.id });
  refresh();
  return ok({}, enRoute ? "On your way 🚗" : "Marked as not left yet");
}

// ============================ shopping ============================
export async function addShopping(input: { item: string; quantity: number; category: string; assignTo?: string | null }): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = z.object({ item: z.string().trim().min(1).max(120), quantity: z.number().finite().int().min(1).max(999), category: z.string().trim().min(1).max(50), assignTo: uuidSchema.nullable().optional() }).safeParse(input);
  if (!parsed.success) return fail("Check the shopping item");
  const { item, category } = parsed.data;
  const qty = parsed.data.quantity;
  const assignTo = parsed.data.assignTo || null;
  const repo = getRepo();
  await repo.addOrMergeShopping({ item, quantity: qty, category, created_by: me.id, claimed_by: assignTo });
  await repo.addActivity(me.id, "shopping_added", `added ${item} ×${qty}`);
  refresh();
  return ok({}, "Added to the list");
}
export async function assignShopping(id: string, userId: string | null): Promise<ActionResult> {
  if (!validId(id) || (userId !== null && !validId(userId))) return fail("Invalid shopping assignment");
  await requireUser();
  await getRepo().assignShopping(id, userId);
  refresh();
  return ok();
}
export async function claimShopping(id: string): Promise<ActionResult> {
  if (!validId(id)) return fail("Invalid shopping item");
  const me = await requireUser();
  const repo = getRepo();
  const res = await repo.claimShopping(id, me.id);
  if (!res.ok) return fail(`Looks like ${await actorName(res.claimedBy)} just claimed this`);
  refresh();
  return ok({}, "You've got it");
}
export async function unclaimShopping(id: string): Promise<ActionResult> {
  if (!validId(id)) return fail("Invalid shopping item");
  const me = await requireUser();
  const repo = getRepo();
  const item = (await repo.listShopping()).find((s) => s.id === id);
  if (!item) return fail("Shopping item not found");
  if (item.claimed_by !== me.id && !me.is_admin) return fail("Only the person getting this or an admin can release it");
  await repo.unclaimShopping(id);
  refresh();
  return ok();
}
export async function toggleShopping(id: string, done: boolean): Promise<ActionResult> {
  if (!validId(id) || typeof done !== "boolean") return fail("Invalid shopping update");
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
  const parsed = z.object({ title: z.string().trim().min(1).max(160), due_date: dateSchema.nullable().optional(), notes: optionalText(2000) }).safeParse(input);
  if (!parsed.success) return fail("Check the task details");
  const { title } = parsed.data;
  const repo = getRepo();
  await repo.addTask({ title, due_date: parsed.data.due_date || null, notes: parsed.data.notes ?? null, created_by: me.id });
  await repo.addActivity(me.id, "task_added", `added task “${title}”`);
  refresh();
  return ok({}, "Task added");
}
export async function editTask(id: string, input: { title: string; due_date?: string | null; notes?: string | null }): Promise<ActionResult> {
  if (!validId(id)) return fail("Invalid task");
  const me = await requireUser();
  const parsed = z.object({ title: z.string().trim().min(1).max(160), due_date: dateSchema.nullable().optional(), notes: optionalText(2000) }).safeParse(input);
  if (!parsed.success) return fail("Check the task details");
  const repo = getRepo();
  const task = (await repo.listTasks()).find((t) => t.id === id);
  if (!task) return fail("Task not found");
  if (task.created_by !== me.id && !me.is_admin) return fail("Only the creator or an admin can edit this");
  const { title } = parsed.data;
  await repo.updateTask(id, { title, due_date: parsed.data.due_date || null, notes: parsed.data.notes || null });
  refresh();
  return ok({}, "Task updated");
}
export async function deleteTask(id: string): Promise<ActionResult> {
  if (!validId(id)) return fail("Invalid task");
  const me = await requireUser();
  const repo = getRepo();
  const task = (await repo.listTasks()).find((t) => t.id === id);
  if (!task) return fail("Task not found");
  if (task.created_by !== me.id && !me.is_admin) return fail("Only the creator or an admin can delete this");
  await repo.deleteTask(id);
  refresh();
  return ok({}, "Task deleted");
}
export async function claimTask(id: string): Promise<ActionResult> {
  if (!validId(id)) return fail("Invalid task");
  const me = await requireUser();
  const repo = getRepo();
  const res = await repo.claimTask(id, me.id);
  if (!res.ok) return fail(`Looks like ${await actorName(res.claimedBy)} is already on it`);
  refresh();
  return ok({}, "You're on it");
}
export async function unclaimTask(id: string): Promise<ActionResult> {
  if (!validId(id)) return fail("Invalid task");
  const me = await requireUser();
  const repo = getRepo();
  const task = (await repo.listTasks()).find((t) => t.id === id);
  if (!task) return fail("Task not found");
  if (task.assigned_to !== me.id && !me.is_admin) return fail("Only the assignee or an admin can release this task");
  await repo.unclaimTask(id);
  refresh();
  return ok();
}
export async function toggleTask(id: string, done: boolean): Promise<ActionResult> {
  if (!validId(id) || typeof done !== "boolean") return fail("Invalid task update");
  const me = await requireUser();
  const repo = getRepo();
  await repo.setTaskDone(id, done, me.id);
  if (done) await repo.addActivity(me.id, "task_completed", "completed a task");
  refresh();
  return ok();
}

// ============================ admin ============================
export async function addAnnouncement(input: { title: string; content?: string | null; is_pinned: boolean; expires_at?: string | null }): Promise<ActionResult> {
  const me = await requireAdmin();
  const parsed = z.object({ title: z.string().trim().min(1).max(160), content: optionalText(4000), is_pinned: z.boolean(), expires_at: isoValue.nullable().optional() }).safeParse(input);
  if (!parsed.success) return fail("Check the announcement details");
  const { title } = parsed.data;
  const repo = getRepo();
  await repo.addAnnouncement({ title, content: parsed.data.content ?? null, is_pinned: parsed.data.is_pinned, expires_at: parsed.data.expires_at ?? null, created_by: me.id });
  await repo.addActivity(me.id, "announcement_added", "posted an announcement");
  refresh();
  return ok({}, "Announcement posted");
}
export async function setAnnouncementPinned(id: string, pinned: boolean): Promise<ActionResult> {
  if (!validId(id) || typeof pinned !== "boolean") return fail("Invalid announcement");
  await requireAdmin();
  await getRepo().setAnnouncementPinned(id, pinned);
  refresh();
  return ok({}, pinned ? "Pinned to Home" : "Unpinned");
}
export async function deleteAnnouncement(id: string): Promise<ActionResult> {
  if (!validId(id)) return fail("Invalid announcement");
  await requireAdmin();
  await getRepo().deleteAnnouncement(id);
  refresh();
  return ok({}, "Announcement removed");
}
export async function setAdmin(userId: string, isAdmin: boolean): Promise<ActionResult> {
  if (!validId(userId) || typeof isAdmin !== "boolean") return fail("Invalid admin update");
  const me = await requireAdmin();
  if (userId === me.id && !isAdmin) return fail("You can't revoke your own admin");
  await getRepo().setAdmin(userId, isAdmin);
  refresh();
  return ok({}, isAdmin ? "Admin granted" : "Admin revoked");
}
export async function updateSettings(input: { app_title?: string; wedding_date?: string; wedding_url?: string }): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z.object({ app_title: z.string().trim().min(1).max(80).optional(), wedding_date: dateSchema.optional(), wedding_url: z.union([z.literal(""), z.string().url().max(500)]).optional() }).strict().safeParse(input);
  if (!parsed.success) return fail("Check the settings");
  await getRepo().updateSettings(parsed.data);
  refresh();
  return ok({}, "Settings saved");
}

// ---------------------------- admin: roster ----------------------------
const newPersonSchema = z.object({
  name: z.string().trim().min(1).max(40),
  username: z.string().trim().toLowerCase().min(2).max(40).regex(/^[a-z0-9][a-z0-9._-]*$/, "Use letters, numbers, dots, dashes or underscores"),
  is_admin: z.boolean().optional(),
});
export async function adminAddPerson(input: unknown): Promise<ActionResult<{ claimCode: string }>> {
  await requireAdmin();
  const parsed = newPersonSchema.safeParse(input);
  if (!parsed.success) return fail("Enter a name and a username (2+ characters)");
  const { name, is_admin } = parsed.data;
  const username = parsed.data.username.toLowerCase();
  const repo = getRepo();
  if (await repo.usernameTaken(username)) return fail("That username is taken");
  const claimCode = newClaimCode();
  await repo.createUser({ name, username, emoji: "🙂", pinHash: PENDING_PIN, claimTokenHash: hashClaimCode(claimCode), is_admin: is_admin ?? false, status: "here" });
  refresh();
  return ok({ claimCode }, `${name} added — copy their one-time invite code now`);
}
export async function adminResetPin(userId: string): Promise<ActionResult<{ claimCode: string }>> {
  const me = await requireAdmin();
  const parsed = z.string().uuid().safeParse(userId);
  if (!parsed.success) return fail("Invalid person");
  if (parsed.data === me.id) return fail("You can't reset your own PIN here");
  if (!(await getRepo().getUser(parsed.data))) return fail("Person not found");
  const claimCode = newClaimCode();
  await getRepo().resetUserPin(parsed.data, hashClaimCode(claimCode));
  refresh();
  return ok({ claimCode }, "PIN reset and all existing sessions revoked — share the new invite code");
}
export async function adminSetRoles(userId: string, roles: string[]): Promise<ActionResult> {
  if (!validId(userId)) return fail("Invalid person");
  await requireAdmin();
  const parsed = z.array(z.enum(["driver", "cook", "host", "coordinator"])).max(4).safeParse(roles);
  if (!parsed.success) return fail("Invalid roles");
  const clean = [...new Set(parsed.data)];
  await getRepo().setUserRoles(userId, clean);
  refresh();
  return ok({}, "Roles updated");
}
// ======================= home layout (self-serve) =======================
// Each person can reorder and hide the widgets on their own home dashboard.
// Mobile and desktop are kept independent.
export async function setHomeLayout(surface: Surface, order: string[], hidden: string[]): Promise<ActionResult> {
  const me = await requireUser();
  const parsed = z.object({ surface: z.enum(["mobile", "desktop"]), order: z.array(z.string()).max(100), hidden: z.array(z.string()).max(100) }).safeParse({ surface, order, hidden });
  if (!parsed.success) return fail("Invalid home layout");
  const layout = sanitiseLayout(parsed.data.surface, parsed.data.order, parsed.data.hidden);
  const prefs: UserPrefs = { ...me.prefs, home: { ...me.prefs.home, [surface]: layout } };
  await getRepo().setUserPrefs(me.id, prefs);
  refresh();
  return ok({}, "Home layout saved");
}

export async function resetHomeLayout(surface: Surface): Promise<ActionResult> {
  const me = await requireUser();
  if (surface !== "mobile" && surface !== "desktop") return fail("Unknown surface");
  const home = { ...me.prefs.home };
  delete home[surface];
  await getRepo().setUserPrefs(me.id, { ...me.prefs, home });
  refresh();
  return ok({}, "Home layout reset to default");
}

export async function adminSetLocation(userId: string, stayingAt: string): Promise<ActionResult> {
  if (!validId(userId) || typeof stayingAt !== "string" || stayingAt.length > 200) return fail("Invalid location");
  await requireAdmin();
  const v = stayingAt.trim();
  await getRepo().setUserLocation(userId, v || null);
  refresh();
  return ok({}, "Location updated");
}
// Phone numbers are admin-only: set here, read server-side, never sent to the
// browser for anyone but an admin.
export async function adminSetPhone(userId: string, phone: string): Promise<ActionResult> {
  if (!validId(userId) || typeof phone !== "string") return fail("Invalid phone number");
  await requireAdmin();
  const v = phone.trim();
  if (v && !/^[\d\s+()-]{6,24}$/.test(v)) return fail("That doesn't look like a phone number");
  await getRepo().setUserPhone(userId, v || null);
  refresh();
  return ok({}, v ? "Phone number updated" : "Phone number cleared");
}
export async function adminRemovePerson(userId: string): Promise<ActionResult> {
  if (!validId(userId)) return fail("Invalid person");
  const me = await requireAdmin();
  if (userId === me.id) return fail("You can't remove yourself");
  await getRepo().deleteUser(userId);
  refresh();
  return ok({}, "Person removed");
}

// ---------------------------- admin: places ----------------------------
export async function adminAddPlace(input: { name: string; address?: string; notes?: string }): Promise<ActionResult> {
  const me = await requireAdmin();
  const parsed = z.object({ name: z.string().trim().min(1).max(120), address: z.string().trim().max(300).optional(), notes: z.string().trim().max(1000).optional() }).safeParse(input);
  if (!parsed.success) return fail("Check the place details");
  await getRepo().createPlace({ name: parsed.data.name, address: parsed.data.address || null, notes: parsed.data.notes || null, created_by: me.id });
  refresh();
  return ok({}, "Place added");
}
export async function adminUpdatePlace(id: string, patch: { name?: string; address?: string | null; notes?: string | null }): Promise<ActionResult> {
  if (!validId(id)) return fail("Invalid place");
  await requireAdmin();
  const parsed = z.object({ name: z.string().trim().min(1).max(120).optional(), address: optionalText(300), notes: optionalText(1000) }).strict().safeParse(patch);
  if (!parsed.success) return fail("Check the place details");
  await getRepo().updatePlace(id, parsed.data);
  refresh();
  return ok({}, "Place updated");
}
export async function adminDeletePlace(id: string): Promise<ActionResult> {
  if (!validId(id)) return fail("Invalid place");
  await requireAdmin();
  await getRepo().deletePlace(id);
  refresh();
  return ok({}, "Place removed");
}

// ---------------------------- admin: important info ----------------------------
export async function adminAddInfo(input: { category: string; title: string; content: string }): Promise<ActionResult> {
  const me = await requireAdmin();
  const parsed = z.object({ category: z.string().trim().min(1).max(80), title: z.string().trim().min(1).max(160), content: z.string().trim().min(1).max(10000) }).safeParse(input);
  if (!parsed.success) return fail("Category, title and content are required and must fit the limits");
  const { category, title, content } = parsed.data;
  await getRepo().addInfo({ category, title, content, created_by: me.id });
  refresh();
  return ok({}, "Info added");
}
export async function adminUpdateInfo(id: string, patch: { category?: string; title?: string; content?: string }): Promise<ActionResult> {
  if (!validId(id)) return fail("Invalid information item");
  const me = await requireAdmin();
  const parsed = z.object({ category: z.string().trim().min(1).max(80).optional(), title: z.string().trim().min(1).max(160).optional(), content: z.string().trim().min(1).max(10000).optional() }).strict().safeParse(patch);
  if (!parsed.success) return fail("Check the information details");
  await getRepo().updateInfo(id, parsed.data, me.id);
  refresh();
  return ok({}, "Info updated");
}
export async function adminDeleteInfo(id: string): Promise<ActionResult> {
  if (!validId(id)) return fail("Invalid information item");
  await requireAdmin();
  await getRepo().deleteInfo(id);
  refresh();
  return ok({}, "Info removed");
}

// ---------------------------- admin: flights ----------------------------
const legEditSchema = z.object({
  flight_number: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,3}\s?\d{1,4}[A-Z]?$/).max(10).optional(),
  airline_name: z.string().trim().max(120).optional(),
  origin_airport: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
  destination_airport: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
  scheduled_departure: isoValue.nullable().optional(),
  scheduled_arrival: isoValue.nullable().optional(),
  terminal_departure: z.string().trim().max(30).nullable().optional(),
  aircraft_type: z.string().trim().max(100).nullable().optional(),
  status: z.enum(["scheduled", "boarding", "air", "landed", "cancelled", "diverted"]).optional(),
});
export async function adminUpdateLeg(legId: string, patch: unknown): Promise<ActionResult> {
  if (!validId(legId)) return fail("Invalid flight");
  await requireAdmin();
  const parsed = legEditSchema.safeParse(patch);
  if (!parsed.success) return fail("Check the flight details");
  const clean = Object.fromEntries(Object.entries(parsed.data).map(([k, v]) => [k, v === "" ? null : v]));
  await getRepo().syncLeg(legId, clean as Partial<import("@/lib/types").FlightLeg>);
  refresh();
  return ok({}, "Flight updated");
}

// ============================ polls ============================
export async function createPoll(input: { question: string; options: string[] }): Promise<ActionResult<{ id: string }>> {
  const me = await requireUser();
  const parsed = z.object({ question: z.string().trim().min(1).max(240), options: z.array(z.string().trim().min(1).max(160)).min(2).max(20) }).safeParse(input);
  if (!parsed.success) return fail("Check the poll question and options");
  const question = parsed.data.question;
  const options = [...new Set(parsed.data.options)];
  if (options.length < 2) return fail("Add at least two options");
  const repo = getRepo();
  const poll = await repo.createPoll({ question, options, created_by: me.id });
  await repo.addActivity(me.id, "poll_created", `started a poll: ${question}`, { type: "poll", id: poll.id });
  refresh();
  return ok({ id: poll.id }, "Poll posted");
}
export async function votePoll(pollId: string, optionId: string): Promise<ActionResult> {
  if (!validId(pollId) || !validId(optionId)) return fail("Invalid poll option");
  const me = await requireUser();
  const repo = getRepo();
  const poll = (await repo.listPolls(me.id)).find((p) => p.id === pollId);
  if (!poll || poll.closed || !poll.options.some((o) => o.id === optionId)) return fail("That poll is closed or the option is invalid");
  await repo.votePoll(pollId, optionId, me.id);
  refresh();
  return ok({}, "Vote counted");
}
export async function setPollClosed(pollId: string, closed: boolean): Promise<ActionResult> {
  if (!validId(pollId) || typeof closed !== "boolean") return fail("Invalid poll update");
  const me = await requireUser();
  const repo = getRepo();
  const poll = (await repo.listPolls(me.id)).find((p) => p.id === pollId);
  if (!poll) return fail("Poll not found");
  if (poll.created_by !== me.id && !me.is_admin) return fail("Only the creator or an admin can do this");
  await repo.setPollClosed(pollId, closed);
  refresh();
  return ok({}, closed ? "Poll closed" : "Poll reopened");
}
export async function deletePoll(pollId: string): Promise<ActionResult> {
  if (!validId(pollId)) return fail("Invalid poll");
  const me = await requireUser();
  const repo = getRepo();
  const poll = (await repo.listPolls(me.id)).find((p) => p.id === pollId);
  if (!poll) return fail("Poll not found");
  if (poll.created_by !== me.id && !me.is_admin) return fail("Only the creator or an admin can delete this");
  await repo.deletePoll(pollId);
  refresh();
  return ok({}, "Poll deleted");
}

// ============================ photos ============================
function detectedImageType(bytes: Uint8Array): string | null {
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && ascii(1, 4) === "PNG") return "image/png";
  if (ascii(0, 3) === "GIF") return "image/gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  if (ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12).toLowerCase();
    if (["avif", "avis"].includes(brand)) return "image/avif";
    if (["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand)) return brand.startsWith("hei") ? "image/heic" : "image/heif";
  }
  return null;
}

/** Upload a photo to the shared gallery. Anyone signed in can add one. */
export async function uploadPhoto(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const me = await requireUser();
  const file = formData.get("file");
  const rawCaption = formData.get("caption");
  const caption = typeof rawCaption === "string" ? rawCaption.trim() || null : null;
  if (caption && caption.length > 500) return fail("Keep the caption under 500 characters");
  if (!(file instanceof File)) return fail("Choose a photo to upload");
  if (file.size > 25 * 1024 * 1024) return fail("That image is too large (max 25 MB)");
  const repo = getRepo();
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const contentType = detectedImageType(bytes);
    if (!contentType) return fail("That file isn't a supported photo (JPG, PNG, WebP, GIF, HEIC or AVIF)");
    const photo = await repo.addPhoto({ bytes, fileName: file.name, contentType, size: file.size, caption, uploaded_by: me.id });
    await repo.addActivity(me.id, "photo_added", "added a photo", { type: "photo", id: photo.id });
    refresh();
    return ok({ id: photo.id }, "Photo added");
  } catch (err) {
    console.error("[uploadPhoto] upload failed:", err);
    return fail("Couldn't upload that photo — try again");
  }
}

export async function editPhotoCaption(id: string, caption: string | null): Promise<ActionResult> {
  if (!validId(id) || (caption !== null && (typeof caption !== "string" || caption.length > 500))) return fail("Invalid caption");
  const me = await requireUser();
  const repo = getRepo();
  const photo = (await repo.listPhotos()).find((p) => p.id === id);
  if (!photo) return fail("Photo not found");
  if (photo.uploaded_by !== me.id && !me.is_admin) return fail("Only the person who added it or an admin can edit it");
  await repo.updatePhotoCaption(id, caption?.trim() || null);
  refresh();
  return ok({}, "Caption updated");
}
export async function deletePhoto(id: string): Promise<ActionResult> {
  if (!validId(id)) return fail("Invalid photo");
  const me = await requireUser();
  const repo = getRepo();
  const photo = (await repo.listPhotos()).find((p) => p.id === id);
  if (!photo) return fail("Photo not found");
  if (photo.uploaded_by !== me.id && !me.is_admin) return fail("Only the person who added it or an admin can remove a photo");
  await repo.deletePhoto(id);
  refresh();
  return ok({}, "Photo removed");
}

export async function whoAmI() {
  return getCurrentUser();
}
