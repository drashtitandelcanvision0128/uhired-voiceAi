import { redirect } from "next/navigation";

export default function MasterOverviewRedirectPage() {
  redirect("/master/dashboard");
}
