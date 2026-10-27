import { redirect } from "next/navigation";
import { getCurrentUser, can } from "@/lib/auth/user";
import { loadPersoneel } from "@/lib/personeel/data";
import { PersoneelWorkspace } from "@/components/personeel/workspace";

export const dynamic = "force-dynamic";

export default async function PersoneelPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; persoon?: string; functie?: string }>;
}) {
  const user = await getCurrentUser();
  if (
    !user?.companyId ||
    !(can(user, "users.view") || can(user, "roles.manage") || can(user, "settings.manage"))
  )
    redirect("/dashboard");

  const [data, initial] = await Promise.all([loadPersoneel(user.companyId), searchParams]);

  return (
    <PersoneelWorkspace
      data={data}
      perms={{
        view: can(user, "users.view"),
        invite: can(user, "users.invite"),
        update: can(user, "users.update"),
        remove: can(user, "users.remove"),
        roles: can(user, "roles.manage"),
        settings: can(user, "settings.manage"),
      }}
      currentUserId={user.id}
      previewBase="/personeel/bekijk/"
      approvalsHref={can(user, "orders.approve") ? "/approvals" : undefined}
      initial={initial}
    />
  );
}
