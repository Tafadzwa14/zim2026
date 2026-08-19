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
  const users = isMemory ? await getRepo().listUsers() : [];
  return (
    <ToastProvider>
      <OnboardingClient isMemory={isMemory} users={users} />
    </ToastProvider>
  );
}
