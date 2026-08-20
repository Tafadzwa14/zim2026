// The home dashboard is built from widgets. This module is the single source
// of truth for which widgets exist, their default order per surface, and how a
// person's saved preferences resolve into a concrete render order. It is pure
// (no JSX, no server-only imports) so both the server home page and the client
// layout editor can share it.

import type { SurfaceLayout, UserPrefs } from "@/lib/types";

export type Surface = "mobile" | "desktop";

/** Display metadata for every customisable home widget. */
export const WIDGET_META: Record<string, { label: string; icon: string; hint?: string }> = {
  "in-the-air": { label: "In the air", icon: "✈️", hint: "Live flights currently airborne" },
  "arriving-today": { label: "Arriving today", icon: "🛬", hint: "Flights landing today" },
  "arrivals": { label: "Arrivals board", icon: "🛫", hint: "All upcoming arrivals" },
  "coming-next": { label: "Coming next", icon: "📅", hint: "The next few arrivals" },
  "coming-up": { label: "Coming up", icon: "🗓️", hint: "The next few days" },
  "today": { label: "Today", icon: "🌤️", hint: "What's happening today" },
  "whos-where": { label: "Who's where", icon: "🏡", hint: "Who's in Zimbabwe and where they're staying" },
  "airport-pickups": { label: "Airport pickups", icon: "🚗", hint: "Runs that need a driver" },
  "tonight": { label: "Tonight", icon: "🍲", hint: "Tonight's dinner plan" },
  "pinned": { label: "Pinned notice", icon: "📢", hint: "The current pinned announcement" },
  "shopping": { label: "Shopping", icon: "🛒", hint: "Open shopping list items" },
  "tasks": { label: "Tasks", icon: "✅", hint: "Open tasks" },
  "activity": { label: "Activity", icon: "💬", hint: "Recent family activity" },
  "important-info": { label: "Important info", icon: "ℹ️", hint: "Emergency and key details" },
  "family-photos": { label: "Family photos", icon: "📸", hint: "Latest shared snaps" },
};

/**
 * The default order of widgets for each surface. Mobile and desktop are
 * deliberately different: the desktop command centre carries panels (Shopping,
 * Tasks, Activity, Info) that the compact mobile home does not.
 */
export const DEFAULT_LAYOUT: Record<Surface, string[]> = {
  mobile: ["family-photos", "in-the-air", "arriving-today", "whos-where", "coming-next", "tonight", "pinned"],
  desktop: [
    "today", "in-the-air", "coming-up", "arrivals", "whos-where", "airport-pickups",
    "family-photos", "shopping", "tasks", "activity", "important-info",
  ],
};

/** Every widget id valid for a surface (used to validate incoming layouts). */
export function widgetIdsFor(surface: Surface): string[] {
  return DEFAULT_LAYOUT[surface];
}

export interface ResolvedWidget {
  id: string;
  label: string;
  icon: string;
  hint?: string;
  visible: boolean;
}

/**
 * Merge a person's saved layout with the current defaults:
 * - respects their saved order for widgets they've arranged,
 * - appends any widgets added in a later release (so new features appear),
 * - drops ids that no longer exist,
 * - applies their hidden set.
 * The result is the full widget list in render order; filter by `visible` to
 * render, or use the whole list to drive the editor.
 */
export function resolveLayout(surface: Surface, saved?: SurfaceLayout): ResolvedWidget[] {
  const base = DEFAULT_LAYOUT[surface];
  const valid = new Set(base);
  const savedOrder = (saved?.order ?? []).filter((id) => valid.has(id));
  const seen = new Set(savedOrder);
  const order = [...savedOrder, ...base.filter((id) => !seen.has(id))];
  const hidden = new Set(saved?.hidden ?? []);
  return order.map((id) => ({
    id,
    label: WIDGET_META[id]?.label ?? id,
    icon: WIDGET_META[id]?.icon ?? "▫️",
    hint: WIDGET_META[id]?.hint,
    visible: !hidden.has(id),
  }));
}

/** Pull a surface's saved layout out of a user's prefs, if any. */
export function surfaceLayout(prefs: UserPrefs | undefined, surface: Surface): SurfaceLayout | undefined {
  return prefs?.home?.[surface];
}

/**
 * Normalise an editor's proposed layout into what we persist: order limited to
 * valid ids for the surface (no dupes), hidden limited to that same set.
 */
export function sanitiseLayout(surface: Surface, order: string[], hidden: string[]): SurfaceLayout {
  const valid = new Set(widgetIdsFor(surface));
  const cleanOrder: string[] = [];
  const seen = new Set<string>();
  for (const id of order) {
    if (valid.has(id) && !seen.has(id)) { cleanOrder.push(id); seen.add(id); }
  }
  const cleanHidden = [...new Set(hidden.filter((id) => valid.has(id)))];
  return { order: cleanOrder, hidden: cleanHidden };
}
