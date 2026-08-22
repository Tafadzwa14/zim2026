import type { FlightProvider } from "./provider";
import type { FlightSearchResult, FlightStatusResult } from "./types";
import { airportLocalToUtcIso } from "@/lib/itinerary-time";

interface DemoFlight {
  airlineName: string;
  airlineCode: string;
  originAirport: string;
  originCity: string;
  destAirport: string;
  destCity: string;
  aircraftType: string;
  aircraftTypeCode: string;
  aircraftRegistration: string;
  depTime: string; // HH:mm
  arrTime: string; // HH:mm
  depTerminal: string | null;
}

// Clearly-labelled demo flights, used when FLIGHT_PROVIDER=mock or no key
// is configured. The UI marks these as demo and never presents them as live.
const DEMO: Record<string, DemoFlight> = {
  EK713: {
    airlineName: "Emirates", airlineCode: "EK",
    originAirport: "DXB", originCity: "Dubai", destAirport: "HRE", destCity: "Harare",
    aircraftType: "Boeing 777-300ER", aircraftTypeCode: "B77W", aircraftRegistration: "A6-ENV",
    depTime: "13:26", arrTime: "17:10", depTerminal: "3",
  },
  QR1367: {
    airlineName: "Qatar Airways", airlineCode: "QR",
    originAirport: "LHR", originCity: "London", destAirport: "HRE", destCity: "Harare",
    aircraftType: "Boeing 787-8", aircraftTypeCode: "B788", aircraftRegistration: "A7-BCX",
    depTime: "08:20", arrTime: "21:40", depTerminal: null,
  },
  SA40: {
    airlineName: "South African", airlineCode: "SA",
    originAirport: "JNB", originCity: "Johannesburg", destAirport: "HRE", destCity: "Harare",
    aircraftType: "Airbus A320", aircraftTypeCode: "A320", aircraftRegistration: "ZS-SZA",
    depTime: "14:00", arrTime: "15:35", depTerminal: "B",
  },
  ET873: {
    airlineName: "Ethiopian", airlineCode: "ET",
    originAirport: "ADD", originCity: "Addis Ababa", destAirport: "HRE", destCity: "Harare",
    aircraftType: "Boeing 737-800", aircraftTypeCode: "B738", aircraftRegistration: "ET-AXK",
    depTime: "10:15", arrTime: "13:05", depTerminal: "2",
  },
};

function build(flightNumber: string, date: string): FlightSearchResult | null {
  const key = flightNumber.toUpperCase().replace(/\s/g, "");
  const d = DEMO[key];
  if (!d) return null;
  return {
    providerFlightId: `mock:${key}:${date}`,
    flightNumber: key,
    airlineName: d.airlineName,
    airlineCode: d.airlineCode,
    departure: {
      airport: d.originAirport, city: d.originCity,
      scheduledTime: airportLocalToUtcIso(`${date}T${d.depTime}`, d.originAirport), estimatedTime: airportLocalToUtcIso(`${date}T${d.depTime}`, d.originAirport),
      actualTime: null, terminal: d.depTerminal, gate: null,
    },
    arrival: {
      airport: d.destAirport, city: d.destCity,
      scheduledTime: airportLocalToUtcIso(`${date}T${d.arrTime}`, d.destAirport), estimatedTime: airportLocalToUtcIso(`${date}T${d.arrTime}`, d.destAirport),
      actualTime: null, terminal: null, gate: null,
    },
    aircraftType: d.aircraftType,
    aircraftTypeCode: d.aircraftTypeCode,
    aircraftRegistration: d.aircraftRegistration,
    status: "scheduled",
  };
}

export class MockFlightProvider implements FlightProvider {
  readonly name = "mock";

  async searchFlight(flightNumber: string, date: string) {
    const r = build(flightNumber, date);
    return r ? [r] : [];
  }

  async getFlightStatus(
    flightNumber: string,
    date: string
  ): Promise<FlightStatusResult | null> {
    const r = build(flightNumber, date);
    if (!r) return null;
    return { ...r, progress: 0, delayMinutes: 0, lastUpdated: `${date}T00:00:00Z` };
  }
}
