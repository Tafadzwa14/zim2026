import "server-only";

// Lightweight weather lookup for a flight's arrival day, via Open-Meteo.
// No API key required. Free forecast reaches ~16 days out, so trips further
// away simply return null and the UI shows nothing.

export interface DayWeather {
  city: string;
  date: string; // YYYY-MM-DD
  min: number;
  max: number;
  emoji: string;
  label: string;
}

// WMO weather codes → a friendly emoji + label. Coarse buckets are plenty here.
function describe(code: number): { emoji: string; label: string } {
  if (code === 0) return { emoji: "☀️", label: "Clear" };
  if (code <= 2) return { emoji: "🌤️", label: "Mostly sunny" };
  if (code === 3) return { emoji: "☁️", label: "Cloudy" };
  if (code <= 48) return { emoji: "🌫️", label: "Fog" };
  if (code <= 57) return { emoji: "🌦️", label: "Drizzle" };
  if (code <= 67) return { emoji: "🌧️", label: "Rain" };
  if (code <= 77) return { emoji: "🌨️", label: "Snow" };
  if (code <= 82) return { emoji: "🌧️", label: "Showers" };
  if (code <= 86) return { emoji: "🌨️", label: "Snow showers" };
  if (code <= 99) return { emoji: "⛈️", label: "Thunderstorm" };
  return { emoji: "🌡️", label: "—" };
}

/** Forecast for `city` on `date` (YYYY-MM-DD), or null if unavailable/out of range. */
export async function getArrivalWeather(city: string | null, date: string | null): Promise<DayWeather | null> {
  if (!city || !date) return null;
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
      { next: { revalidate: 86_400 } },
    );
    if (!geoRes.ok) return null;
    const geo = (await geoRes.json()) as { results?: { latitude: number; longitude: number }[] };
    const loc = geo.results?.[0];
    if (!loc) return null;

    const fRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}` +
        `&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto&start_date=${date}&end_date=${date}`,
      { next: { revalidate: 3600 } },
    );
    if (!fRes.ok) return null;
    const f = (await fRes.json()) as {
      daily?: { time: string[]; temperature_2m_max: number[]; temperature_2m_min: number[]; weather_code: number[] };
    };
    const d = f.daily;
    if (!d?.time?.length || d.temperature_2m_max?.[0] == null) return null;

    const { emoji, label } = describe(d.weather_code[0]);
    return {
      city,
      date,
      min: Math.round(d.temperature_2m_min[0]),
      max: Math.round(d.temperature_2m_max[0]),
      emoji,
      label,
    };
  } catch {
    return null;
  }
}
