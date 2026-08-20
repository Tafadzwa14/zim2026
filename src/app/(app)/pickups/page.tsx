import { redirect } from "next/navigation";

// Airport pickups now live on the Flights tab.
export default function PickupsPage() {
  redirect("/flights");
}
