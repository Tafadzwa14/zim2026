import { describe, expect, it } from "vitest";
import { airportLocalToUtcIso } from "./itinerary-time";

describe("airportLocalToUtcIso", () => {
  it("uses the airport's winter offset instead of an offset in the input", () => {
    expect(airportLocalToUtcIso("2026-08-22T09:30:00+00:00", "MEL"))
      .toBe("2026-08-21T23:30:00Z");
  });

  it("uses daylight saving time when it applies", () => {
    expect(airportLocalToUtcIso("2026-01-15T09:30:00Z", "MEL"))
      .toBe("2026-01-14T22:30:00Z");
  });

  it("rejects a wall-clock time skipped by the DST change", () => {
    expect(airportLocalToUtcIso("2026-10-04T02:30:00Z", "MEL")).toBeNull();
  });
});
