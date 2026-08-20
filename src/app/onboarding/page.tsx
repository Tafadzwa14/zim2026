import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentUser } from "@/lib/identity";
import { getRepo } from "@/lib/repo";
import { ToastProvider } from "@/components/providers";
import { OnboardingClient } from "@/components/onboarding-client";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");
  const isMemory = !isSupabaseConfigured();
  const roster = await getRepo().listRoster();
  const pending = roster.filter((u) => !u.claimed);
  const claimed = roster.filter((u) => u.claimed);
  return (
    <ToastProvider>
      <OnboardingClient isMemory={isMemory} pending={pending} claimed={claimed} />
    </ToastProvider>
  );
}
