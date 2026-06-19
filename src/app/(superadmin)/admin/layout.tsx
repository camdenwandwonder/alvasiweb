import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/user";
import { Shell } from "@/components/shell";

export const dynamic = "force-dynamic";

const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/companies", label: "Companies" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isSuperadmin) redirect("/dashboard");

  return (
    <Shell
      brandName="Alvasi"
      subtitle="Superadmin"
      nav={nav}
      userLabel={user.email ?? ""}
    >
      {children}
    </Shell>
  );
}
