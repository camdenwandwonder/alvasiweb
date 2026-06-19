import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isSuperadmin) redirect("/admin");
  redirect("/dashboard");
}
