import { redirect } from "next/navigation";

// Plans merged into the Calendar tab (Plans view). Keep the URL working.
export default function PlansIndexRedirect() {
  redirect("/calendar?view=plans");
}
