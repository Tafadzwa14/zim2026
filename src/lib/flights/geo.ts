// Airport coordinates and great-circle maths, used to turn a live OpenSky
// position into a 0..1 route fraction for the plane on the route map. Pure
// (no secrets), safe to import anywhere.

export interface LatLng {
  latitude: number;
  longitude: number;
}

// IATA -> coordinates for airports on our itineraries. Extend as new ones
// appear. A missing airport just means we fall back to the time estimate.
export const AIRPORTS: Record<string, LatLng> = {
  HRE: { latitude: -17.9319, longitude: 31.0928 }, // Harare
  VFA: { latitude: -18.0959, longitude: 25.839 }, // Victoria Falls
  BUQ: { latitude: -20.0174, longitude: 28.6179 }, // Bulawayo
  JNB: { latitude: -26.1392, longitude: 28.246 }, // Johannesburg
  CPT: { latitude: -33.969, longitude: 18.6017 }, // Cape Town
  ADD: { latitude: 8.9779, longitude: 38.7993 }, // Addis Ababa
  NBO: { latitude: -1.3192, longitude: 36.9278 }, // Nairobi
  DXB: { latitude: 25.2532, longitude: 55.3657 }, // Dubai
  DOH: { latitude: 25.2731, longitude: 51.6081 }, // Doha
  IST: { latitude: 41.2753, longitude: 28.7519 }, // Istanbul
  LHR: { latitude: 51.47, longitude: -0.4543 }, // London Heathrow
  AMS: { latitude: 52.3105, longitude: 4.7683 }, // Amsterdam
  PER: { latitude: -31.9403, longitude: 115.9669 }, // Perth
  SYD: { latitude: -33.9399, longitude: 151.1753 }, // Sydney
  MEL: { latitude: -37.669, longitude: 144.841 }, // Melbourne
  BNE: { latitude: -27.3842, longitude: 153.1175 }, // Brisbane
};

/** Great-circle distance in kilometres (haversine). */
function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Fraction (0..1) of the route the aircraft has covered, from a live
 * position. Uses distance-flown / (distance-flown + distance-to-go) so an
 * off-track position still maps to a sane point on the curve. Returns null
 * when either airport is unknown, so the caller can fall back to the estimate.
 */
export function routeFraction(
  originIata: string,
  destIata: string,
  pos: LatLng
): number | null {
  const o = AIRPORTS[originIata?.toUpperCase()];
  const d = AIRPORTS[destIata?.toUpperCase()];
  if (!o || !d) return null;
  const done = haversineKm(o, pos);
  const togo = haversineKm(pos, d);
  const denom = done + togo;
  if (denom <= 0) return null;
  return Math.min(1, Math.max(0, done / denom));
}
