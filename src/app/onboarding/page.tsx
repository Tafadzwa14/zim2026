import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity";
import { getRepo } from "@/lib/repo";
import { ToastProvider } from "@/components/providers";
import { OnboardingClient } from "@/components/onboarding-client";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");
  // Onboarding runs before sign-in, so drop the admin-only phone number here:
  // RosterUser is assignable to PublicUser, so nothing would flag the extra
  // field, but it would still ride into the client payload.
  const roster = (await getRepo().listRoster()).map((u) => {
    const { phone_number: _phone, username: _username, roles: _roles, staying_at: _staying, prefs: _prefs, is_admin: _admin, status: _status, pin_reset_requested: _reset, created_at: _created, updated_at: _updated, ...rest } = u;
    void _phone;
    void _username; void _roles; void _staying; void _prefs; void _admin; void _status; void _reset; void _created; void _updated;
    return rest;
  });
  const pending = roster.filter((u) => !u.claimed);
  const claimed = roster.filter((u) => u.claimed);
  return (
    <ToastProvider>
      <OnboardingClient pending={pending} claimed={claimed} />
    </ToastProvider>
  );
}
