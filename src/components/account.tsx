"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "@/lib/use-action";
import * as actions from "@/lib/actions";
import { Spinner } from "@/components/ui";
import type { AppSettings } from "@/lib/types";

export function SignOutButton() {
  const { run } = useAction();
  const router = useRouter();
  return (
    <button className="zc-btn zc-btn-ghost w-full" onClick={() => run(() => actions.signOut(), { onSuccess: () => router.push("/onboarding"), silent: true })}>
      Sign out
    </button>
  );
}

export function SettingsForm({ settings }: { settings: AppSettings }) {
  const { run, pending } = useAction();
  const [f, setF] = useState({ app_title: settings.app_title, wedding_date: settings.wedding_date, wedding_url: settings.wedding_url });
  return (
    <form onSubmit={(e) => { e.preventDefault(); run(() => actions.updateSettings(f)); }}>
      <label className="zc-label">App title</label>
      <input className="zc-input" value={f.app_title} onChange={(e) => setF({ ...f, app_title: e.target.value })} />
      <label className="zc-label">Wedding date</label>
      <input type="date" className="zc-input" value={f.wedding_date} onChange={(e) => setF({ ...f, wedding_date: e.target.value })} />
      <label className="zc-label">Wedding website URL</label>
      <input className="zc-input" value={f.wedding_url} onChange={(e) => setF({ ...f, wedding_url: e.target.value })} placeholder="https://…" />
      <button className="zc-btn mt-4 w-full py-3 text-sm" disabled={pending}>{pending && <Spinner />}{pending ? "Saving…" : "Save settings"}</button>
    </form>
  );
}
