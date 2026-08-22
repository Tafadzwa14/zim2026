import "server-only";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/server-env";
import { getRepo } from "@/lib/repo";
import type { PublicUser } from "@/lib/types";

const COOKIE = "zim_session";

function secret(): string {
  return serverEnv.pinPepper;
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

/** One-way representation of a per-person, one-time identity claim code. */
export function hashClaimCode(code: string): string {
  return crypto.createHmac("sha256", secret()).update(code.trim()).digest("hex");
}

export function newClaimCode(): string {
  return crypto.randomBytes(12).toString("base64url");
}

// ---- signed session cookie ----
function sign(id: string, version: number, expiresAt: number): string {
  const payload = `${id}:${version}:${expiresAt}`;
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  return `${payload}.${sig}`;
}
function unsign(value: string): { id: string; version: number } | null {
  const i = value.lastIndexOf(".");
  if (i < 0) return null;
  const payload = value.slice(0, i);
  const sig = value.slice(i + 1);
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return null;
  } catch {
    return null;
  }
  const [id, rawVersion, rawExpiry] = payload.split(":");
  const version = Number(rawVersion);
  const expiresAt = Number(rawExpiry);
  if (!id || !Number.isInteger(version) || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  return { id, version };
}

export async function setSession(userId: string, sessionVersion: number): Promise<void> {
  const c = await cookies();
  const maxAge = 60 * 60 * 24 * 30;
  c.set(COOKIE, sign(userId, sessionVersion, Date.now() + maxAge * 1000), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}
export async function clearSession(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE);
}
export async function getSessionUserId(): Promise<string | null> {
  const c = await cookies();
  const v = c.get(COOKIE)?.value;
  const session = v ? unsign(v) : null;
  if (!session) return null;
  const currentVersion = await getRepo().getSessionVersion(session.id);
  return currentVersion === session.version ? session.id : null;
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
