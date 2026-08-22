// Provision admin-created "pending" identities. Each person claims theirs in
// the app (picks emoji + PIN). Run from the project root:
//
//   node scripts/provision-users.mjs "Taffie:admin" "Tapiwa" "Zoe"
//
// Token format: "Name" or "Name:admin". Username = the name verbatim.
// pin_hash is the PENDING sentinel until claimed. Re-running skips names whose
// username already exists, so it is safe to run again to add more people.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { createHmac, randomBytes } from "node:crypto";

const PENDING_PIN = "PENDING";
const DEFAULT_EMOJI = "🙂";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
if (!env.APP_PIN_PEPPER) throw new Error("APP_PIN_PEPPER is required");

const tokens = process.argv.slice(2);
if (tokens.length === 0) {
  console.error('Usage: node scripts/provision-users.mjs "Taffie:admin" "Tapiwa" ...');
  process.exit(1);
}

for (const token of tokens) {
  const [name, flag] = token.split(":");
  const clean = name.trim();
  const username = clean.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, "");
  const is_admin = flag === "admin";

  const { data: existing } = await sb.from("users").select("id").ilike("username", username).maybeSingle();
  if (existing) { console.log(`skip   ${clean} (@${username} exists)`); continue; }

  const claimCode = randomBytes(12).toString("base64url");
  const claimTokenHash = createHmac("sha256", env.APP_PIN_PEPPER).update(claimCode).digest("hex");
  const { error } = await sb.from("users").insert({
    name: clean, username, emoji: DEFAULT_EMOJI, pin_hash: PENDING_PIN, claim_token_hash: claimTokenHash, is_admin, status: "here",
  });
  if (error) { console.error(`FAIL   ${clean}: ${error.message}`); process.exit(1); }
  console.log(`added  ${clean} (@${username})${is_admin ? " — admin" : ""} — invite code: ${claimCode}`);
}
console.log("done");
