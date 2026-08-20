// Pure helper for map/directions links. Safe on client or server.

/** A Google Maps search URL for a place name and/or address. */
export function mapsUrl(...parts: (string | null | undefined)[]): string {
  const query = parts.map((p) => p?.trim()).filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
