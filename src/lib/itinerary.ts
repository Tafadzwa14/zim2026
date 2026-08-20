import "server-only";

import OpenAI from "openai";
import { serverEnv } from "@/lib/env";

/** One flight segment as read from an itinerary PDF. A layover is just the
 *  next segment. Times are ISO 8601 in the airport's local offset when known. */
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
          scheduled_departure: { type: ["string", "null"], description: "ISO 8601 with the departure airport's UTC offset if determinable" },
          scheduled_arrival: { type: ["string", "null"], description: "ISO 8601 with the arrival airport's UTC offset if determinable" },
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
  "For departure and arrival times, output ISO 8601 and include the local UTC offset of that airport when you can determine it. " +
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
  // Normalise flight numbers so they match the provider's expectations.
  parsed.legs = (parsed.legs ?? []).map((l) => ({
    ...l,
    flight_number: (l.flight_number ?? "").toUpperCase().replace(/\s+/g, ""),
    origin_airport: (l.origin_airport ?? "").toUpperCase(),
    destination_airport: (l.destination_airport ?? "").toUpperCase(),
  }));
  return parsed;
}
