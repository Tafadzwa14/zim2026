import "server-only";

import type { FlightStatus } from "@/lib/types";
import { serverEnv } from "@/lib/env";
import type { FlightProvider } from "./provider";
import type {
  FlightEndpoint,
  FlightSearchResult,
  FlightStatusResult,
} from "./types";

// Minimal shape of the AeroDataBox "flights/number" response we rely on.
interface AdbTime {
  utc?: string | null;
  local?: string | null;
}
interface AdbEndpoint {
  airport?: { iata?: string; icao?: string; name?: string; municipalityName?: string };
  scheduledTime?: AdbTime | null;
  revisedTime?: AdbTime | null;
  runwayTime?: AdbTime | null;
  terminal?: string | null;
  gate?: string | null;
}
interface AdbFlight {
  number?: string;
  status?: string;
  departure?: AdbEndpoint;
  arrival?: AdbEndpoint;
  aircraft?: { reg?: string; model?: string };
  airline?: { name?: string; iata?: string; icao?: string };
}

function isoFromAdb(t?: AdbTime | null): string | null {
  const raw = t?.utc ?? null;
  if (!raw) return null;
  // AeroDataBox format: "2026-08-19 13:26Z" -> "2026-08-19T13:26:00Z"
  const normalised = raw.replace(" ", "T").replace(/Z?$/, "");
  const withSeconds = /T\d{2}:\d{2}$/.test(normalised) ? `${normalised}:00` : normalised;
  return `${withSeconds}Z`;
}

function mapStatus(s?: string): FlightStatus {
  const v = (s ?? "").toLowerCase();
  if (["arrived", "landed"].includes(v)) return "landed";
  if (["enroute", "departed", "approaching", "airborne"].includes(v)) return "air";
  if (["boarding", "gateclosed"].includes(v)) return "boarding";
  if (v === "cancelled" || v === "canceled") return "cancelled";
  if (v === "diverted") return "diverted";
  if (["scheduled", "expected", "delayed", "checkin"].includes(v)) return "scheduled";
  return "unknown";
}

function endpoint(e?: AdbEndpoint): FlightEndpoint {
  return {
    airport: e?.airport?.iata ?? e?.airport?.icao ?? "",
    city: e?.airport?.municipalityName ?? null,
    scheduledTime: isoFromAdb(e?.scheduledTime),
    estimatedTime: isoFromAdb(e?.revisedTime) ?? isoFromAdb(e?.scheduledTime),
    actualTime: isoFromAdb(e?.runwayTime),
    terminal: e?.terminal ?? null,
    gate: e?.gate ?? null,
  };
}

function typeCode(model?: string | null): string | null {
  if (!model) return null;
  const m = model.toLowerCase();
  if (m.includes("777-300")) return "B77W";
  if (m.includes("777")) return "B772";
  if (m.includes("787-9")) return "B789";
  if (m.includes("787")) return "B788";
  if (m.includes("737-800")) return "B738";
  if (m.includes("a380")) return "A388";
  if (m.includes("a350")) return "A359";
  if (m.includes("a330")) return "A333";
  if (m.includes("a320")) return "A320";
  if (m.includes("a319")) return "A319";
  return null;
}

function toResult(f: AdbFlight): FlightSearchResult {
  return {
    providerFlightId: `adb:${f.number ?? ""}`,
    flightNumber: (f.number ?? "").replace(/\s/g, ""),
    airlineName: f.airline?.name ?? null,
    airlineCode: f.airline?.iata ?? f.airline?.icao ?? null,
    departure: endpoint(f.departure),
    arrival: endpoint(f.arrival),
    aircraftType: f.aircraft?.model ?? null,
    aircraftTypeCode: typeCode(f.aircraft?.model),
    aircraftRegistration: f.aircraft?.reg ?? null,
    status: mapStatus(f.status),
  };
}

function delayMinutes(f: FlightSearchResult): number | null {
  const sched = f.arrival.scheduledTime;
  const est = f.arrival.estimatedTime ?? f.arrival.actualTime;
  if (!sched || !est) return null;
  const diff = (new Date(est).getTime() - new Date(sched).getTime()) / 60000;
  return Math.round(diff);
}

/**
 * AeroDataBox provider (via RapidAPI). Chosen for solid Harare / Africa
 * and Emirates coverage with live status and aircraft data. Swap by
 * implementing FlightProvider and pointing the factory at it.
 */
export class AeroDataBoxProvider implements FlightProvider {
  readonly name = "aerodatabox";

  private async call(path: string): Promise<unknown> {
    const host = serverEnv.aerodataboxHost;
    const res = await fetch(`https://${host}${path}`, {
      headers: {
        "X-RapidAPI-Key": serverEnv.aerodataboxKey,
        "X-RapidAPI-Host": host,
      },
      // Cache at the fetch layer; the service layer adds its own TTL too.
      next: { revalidate: 60 },
    });
    if (res.status === 404) return [];
    if (!res.ok) {
      throw new Error(`AeroDataBox ${res.status}: ${await res.text().catch(() => "")}`);
    }
    return res.json();
  }

  async searchFlight(flightNumber: string, date: string): Promise<FlightSearchResult[]> {
    const num = flightNumber.toUpperCase().replace(/\s/g, "");
    const data = await this.call(`/flights/number/${encodeURIComponent(num)}/${date}`);
    const list = Array.isArray(data) ? (data as AdbFlight[]) : [];
    return list.map(toResult);
  }

  async getFlightStatus(
    flightNumber: string,
    date: string
  ): Promise<FlightStatusResult | null> {
    const results = await this.searchFlight(flightNumber, date);
    const base = results[0];
    if (!base) return null;
    return {
      ...base,
      progress: null, // computed by the service layer from times
      delayMinutes: delayMinutes(base),
      lastUpdated: new Date().toISOString(),
    };
  }
}
