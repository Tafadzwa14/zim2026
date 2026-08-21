import { redirect } from "next/navigation";

// Family merged into the Info tab (directory sits above the important info).
export default function FamilyIndexRedirect() {
  redirect("/info");
}
