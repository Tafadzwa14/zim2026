import type { FlightStatus, PlanCategory } from "@/lib/types";

export const CATEGORIES: { id: PlanCategory; icon: string; label: string }[] = [
  { id: "travel", icon: "✈️", label: "Travel" },
  { id: "family", icon: "👨‍👩‍👧", label: "Family" },
  { id: "wedding", icon: "💍", label: "Wedding" },
  { id: "dinner", icon: "🍽️", label: "Dinner" },
  { id: "shopping", icon: "🛍️", label: "Shopping" },
  { id: "transport", icon: "🚗", label: "Transport" },
  { id: "social", icon: "🎉", label: "Social" },
  { id: "important", icon: "📌", label: "Important" },
];

export function categoryOf(id: string) {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[1];
}

/** Fixed milestone events beyond the wedding, surfaced as big events. */
export const GOGO_BIRTHDAY = { date: "2026-09-15", time: null, title: "Gogo's Birthday", icon: "🎂" } as const;

export type StatusTone = "air" | "sched" | "land" | "cancel";
export function flightStatusMeta(status: FlightStatus): { label: string; tone: StatusTone } {
  switch (status) {
    case "air":
      return { label: "In the air", tone: "air" };
    case "boarding":
      return { label: "Boarding", tone: "sched" };
    case "landed":
      return { label: "Landed", tone: "land" };
    case "cancelled":
      return { label: "Cancelled", tone: "cancel" };
    case "diverted":
      return { label: "Diverted", tone: "cancel" };
    default:
      return { label: "Scheduled", tone: "sched" };
  }
}

/** Curated emoji set for the picker, with search keywords. */
export const EMOJIS: [string, string][] = [
  ["🏎️", "car race speed"], ["😎", "cool sunglasses"], ["🦋", "butterfly"], ["🦁", "lion"],
  ["🕶️", "glasses cool"], ["🌸", "flower blossom"], ["👵", "grandma gogo"], ["👴", "grandpa"],
  ["🌼", "flower"], ["🐘", "elephant"], ["🦒", "giraffe"], ["⚽", "soccer football"],
  ["🎨", "art paint"], ["🌺", "flower"], ["🦏", "rhino"], ["🎸", "guitar music"],
  ["🚗", "car"], ["✈️", "plane travel"], ["🌍", "earth africa"], ["🦓", "zebra"],
  ["🐆", "leopard"], ["🍲", "food pot"], ["☕", "coffee"], ["📷", "camera photo"],
  ["⭐", "star"], ["🔥", "fire"], ["💃", "dance"], ["🕺", "dance man"],
  ["👑", "crown king queen"], ["🌟", "star glow"], ["🐝", "bee"], ["🦅", "eagle bird"],
  ["🌻", "sunflower"], ["🍉", "watermelon"], ["🥁", "drum music"], ["🎧", "headphones"],
  ["🏀", "basketball"], ["🎯", "target darts"], ["🧵", "tailor sewing"], ["💐", "bouquet flowers"],
];
