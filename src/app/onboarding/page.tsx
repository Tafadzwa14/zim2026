import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/identity";
import { getRepo } from "@/lib/repo";
import { ToastProvider } from "@/components/providers";
import { OnboardingClient } from "@/components/onboarding-client";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");
  const roster = await getRepo().listRoster();
  const pending = roster.filter((u) => !u.claimed);
  const claimed = roster.filter((u) => u.claimed);
  return (
    <ToastProvider>
      <OnboardingClient pending={pending} claimed={claimed} />
    </ToastProvider>
  );
}
