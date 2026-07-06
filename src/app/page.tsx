import { redirect } from "next/navigation";
import { getCurrentUser, isMember } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuperadmin) redirect("/admin");
  // Plain members go straight to the shop; managers get the dashboard.
  if (isMember(user)) redirect("/products");
  redirect("/dashboard");
}
