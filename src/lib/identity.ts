import "server-only";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";
import { getRepo } from "@/lib/repo";
import type { PublicUser } from "@/lib/types";

const COOKIE = "zim_session";

function secret(): string {
  return serverEnv.pinPepper || "zim-dev-secret-change-me";
}

// Sentinel pin_hash for admin-provisioned identities not yet claimed by a
// person. It has no ":" separator, so verifyPin() always rejects it — a pending
// identity can't be logged into until claimed (emoji + real PIN set).
export const PENDING_PIN = "PENDING";

/** True once a real PIN has been set (hashPin output is "salt:hash"). */
export function isClaimed(pinHash: string): boolean {
  return pinHash.includes(":");
}

// ---- PIN hashing (scrypt; never store plaintext, spec section 49) ----
export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pin + secret(), salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(pin + secret(), salt, 32).toString("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(test, "hex"));
  } catch {
    return false;
  }
}

// ---- signed session cookie ----
function sign(id: string): string {
  const sig = crypto.createHmac("sha256", secret()).update(id).digest("hex").slice(0, 32);
  return `${id}.${sig}`;
}
function unsign(value: string): string | null {
  const i = value.lastIndexOf(".");
  if (i < 0) return null;
  const id = value.slice(0, i);
  const sig = value.slice(i + 1);
  const expected = crypto.createHmac("sha256", secret()).update(id).digest("hex").slice(0, 32);
  return sig === expected ? id : null;
}

export async function setSession(userId: string): Promise<void> {
  const c = await cookies();
  c.set(COOKIE, sign(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
export async function clearSession(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE);
}
export async function getSessionUserId(): Promise<string | null> {
  const c = await cookies();
  const v = c.get(COOKIE)?.value;
  return v ? unsign(v) : null;
}
export async function getCurrentUser(): Promise<PublicUser | null> {
  const id = await getSessionUserId();
  if (!id) return null;
  return getRepo().getUser(id);
}
export async function requireUser(): Promise<PublicUser> {
  const u = await getCurrentUser();
  if (!u) throw new Error("Not signed in");
  return u;
}
export async function requireAdmin(): Promise<PublicUser> {
  const u = await requireUser();
  if (!u.is_admin) throw new Error("This action is for admins only");
  return u;
}
