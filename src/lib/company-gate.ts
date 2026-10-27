import "server-only";
import { getCurrentUser, can, type CurrentUser } from "@/lib/auth/user";
import { createAdminClient } from "@/lib/supabase/server";

/** Superadmin, or a member of this company holding the permission. */
export async function companyGate(
  companyId: string,
  permission: string,
): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.isSuperadmin) return user;
  if (user.companyId === companyId && can(user, permission)) return user;
  return null;
}

/** Records a change in the company's history. Never throws. */
export async function logAudit(entry: {
  companyId: string;
  actor: CurrentUser | null;
  targetType: "user" | "role" | "settings" | "budget_request" | "order";
  targetId?: string | null;
  action: string;
  summary: string;
}) {
  try {
    await createAdminClient()
      .from("audit_log")
      .insert({
        company_id: entry.companyId,
        actor_id: entry.actor?.id ?? null,
        actor_name: entry.actor?.isSuperadmin
          ? `${entry.actor.fullName ?? entry.actor.email ?? "Alvasi"} (Alvasi)`
          : (entry.actor?.fullName ?? entry.actor?.email ?? null),
        target_type: entry.targetType,
        target_id: entry.targetId ?? null,
        action: entry.action,
        summary: entry.summary,
      });
  } catch {
    // history is best-effort; never block the actual change
  }
}
