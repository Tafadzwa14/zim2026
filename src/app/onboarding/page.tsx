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
    const { phone_number: _phone, ...rest } = u;
    void _phone;
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
