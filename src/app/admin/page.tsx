import { redirect } from "next/navigation";

export default function AdminIndexPage() {
  // Redirect base /admin to the first dashboard page (analytics)
  redirect("/admin/analytics");
}
