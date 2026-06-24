import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/user";
import { getIntegration } from "@/lib/jamespro/sync";
import { PageHeader } from "@/components/primitives";
import { JamesproSettings } from "./jamespro-settings";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const user = await getCurrentUser();
  if (!user?.isSuperadmin) redirect("/admin");

  const i = await getIntegration();
  // Never send secrets to the client — only connection status + config.
  const safe = {
    connected: !!(i?.auth_key && i?.auth_secret),
    enabled: !!i?.enabled,
    deviceType: i?.device_type ?? "Alvasi",
    defaultUserId: i?.default_user_id ?? null,
    connectedUser: i?.connected_user ?? null,
    lastTestedAt: i?.last_tested_at ?? null,
    projectTitleTemplate: i?.project_title_template ?? null,
    projectBriefingTemplate: i?.project_briefing_template ?? null,
    taskDescriptionTemplate: i?.task_description_template ?? null,
    taskNoteTemplate: i?.task_note_template ?? null,
  };

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Integraties"
        description="Koppel Alvasi met JamesPRO. Bij elke goedgekeurde bestelling wordt automatisch een project en taak aangemaakt bij de juiste relatie."
      />
      <JamesproSettings integration={safe} />
    </div>
  );
}
