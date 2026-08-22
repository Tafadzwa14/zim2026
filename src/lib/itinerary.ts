import "server-only";

import OpenAI from "openai";
import { serverEnv } from "@/lib/server-env";
import { airportLocalToUtcIso } from "@/lib/itinerary-time";

/** One flight segment as read from an itinerary PDF. A layover is just the
 *  next segment. Times are absolute UTC instants once normalised; see below. */
export interface ExtractedLeg {
  flight_number: string;
  airline_name: string | null;
  airline_code: string | null;
  origin_airport: string;
  origin_city: string | null;
  destination_airport: string;
  destination_city: string | null;
  scheduled_departure: string | null;
  scheduled_arrival: string | null;
  terminal_departure: string | null;
  aircraft_type: string | null;
}

export interface ExtractedItinerary {
  legs: ExtractedLeg[];
  passengers: string[];
  booking_reference: string | null;
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    legs: {
      type: "array",
      description: "Every flight segment in travel order; each layover is its own segment.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          flight_number: { type: "string", description: "e.g. EK713 — airline code + number, uppercase, no spaces" },
          airline_name: { type: ["string", "null"] },
          airline_code: { type: ["string", "null"], description: "2-letter IATA airline code, e.g. EK" },
          origin_airport: { type: "string", description: "IATA 3-letter code, e.g. DXB" },
          origin_city: { type: ["string", "null"] },
          destination_airport: { type: "string", description: "IATA 3-letter code, e.g. HRE" },
          destination_city: { type: ["string", "null"] },
          scheduled_departure: { type: ["string", "null"], description: "Local departure time at the origin airport as printed, format YYYY-MM-DDTHH:mm, with NO timezone offset — just the wall-clock time and date shown on the itinerary" },
          scheduled_arrival: { type: ["string", "null"], description: "Local arrival time at the destination airport as printed, format YYYY-MM-DDTHH:mm, with NO timezone offset — just the wall-clock time and date shown on the itinerary" },
          terminal_departure: { type: ["string", "null"] },
          aircraft_type: { type: ["string", "null"] },
        },
        required: [
          "flight_number", "airline_name", "airline_code", "origin_airport", "origin_city",
          "destination_airport", "destination_city", "scheduled_departure", "scheduled_arrival",
          "terminal_departure", "aircraft_type",
        ],
      },
    },
    passengers: { type: "array", items: { type: "string" }, description: "Passenger names found on the itinerary" },
    booking_reference: { type: ["string", "null"], description: "Booking reference / PNR if present" },
  },
  required: ["legs", "passengers", "booking_reference"],
} as const;

const INSTRUCTION =
  "You are reading a flight itinerary or e-ticket. Extract every flight segment in travel order. " +
  "Treat each layover as its own segment (a 3-leg trip has 3 segments). Use IATA 3-letter airport codes. " +
  "For departure and arrival times, transcribe the LOCAL wall-clock time shown at each airport exactly as printed, " +
  "in the format YYYY-MM-DDTHH:mm with NO timezone offset and no 'Z'. Do not convert between timezones and do not " +
  "add a UTC offset — just copy the date and time as they appear. " +
  "If a value is not present, use null. Never invent flights, airports, or times that are not in the document.";

/**
 * Read the flight legs out of an itinerary PDF using OpenAI. Throws on a
 * missing key or an unparseable response; the caller turns that into a
 * friendly action error.
 */
export async function parseItineraryPdf(bytes: Uint8Array, filename: string): Promise<ExtractedItinerary> {
  if (!serverEnv.openaiApiKey) throw new Error("OpenAI is not configured");
  const client = new OpenAI({ apiKey: serverEnv.openaiApiKey });
  const base64 = Buffer.from(bytes).toString("base64");

  const response = await client.responses.create({
    model: serverEnv.openaiModel,
    input: [
      {
        role: "user",
        content: [
          { type: "input_file", filename, file_data: `data:application/pdf;base64,${base64}` },
          { type: "input_text", text: INSTRUCTION },
        ],
      },
    ],
    text: { format: { type: "json_schema", name: "itinerary", schema: SCHEMA, strict: true } },
  });

  const raw = response.output_text;
  if (!raw) throw new Error("No itinerary data returned");
  const parsed = JSON.parse(raw) as ExtractedItinerary;
  // Normalise codes, then pin the model's wall-clock times to real UTC instants
  // ourselves using the airport zone. The model only transcribes the printed
  // local time; we own the offset, so a wrong or missing offset from the model
  // can no longer land a time in the DB tagged as UTC.
  parsed.legs = (parsed.legs ?? []).map((l) => {
    const origin = (l.origin_airport ?? "").toUpperCase();
    const destination = (l.destination_airport ?? "").toUpperCase();
    return {
      ...l,
      flight_number: (l.flight_number ?? "").toUpperCase().replace(/\s+/g, ""),
      origin_airport: origin,
      destination_airport: destination,
      scheduled_departure: airportLocalToUtcIso(l.scheduled_departure, origin),
      scheduled_arrival: airportLocalToUtcIso(l.scheduled_arrival, destination),
    };
  });
  return parsed;
}
