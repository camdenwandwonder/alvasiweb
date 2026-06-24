/** JamesPRO sync orchestration. Server-only (uses the service-role client). */

import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import {
  jamesproCreateProject,
  jamesproCreateTask,
  jamesproGetProject,
  type JamesproCreds,
} from "./client";
import {
  DEFAULT_TEMPLATES,
  buildOrderTokens,
  renderTemplate,
} from "./templates";

const MAX_ATTEMPTS = 5;

export type Integration = {
  id: number;
  enabled: boolean;
  auth_key: string | null;
  auth_secret: string | null;
  device_type: string;
  default_user_id: number | null;
  project_title_template: string | null;
  project_briefing_template: string | null;
  task_description_template: string | null;
  task_note_template: string | null;
  connected_user: { id: number; name: string } | null;
  last_tested_at: string | null;
};

export async function getIntegration(): Promise<Integration | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("integration_jamespro")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  return (data as Integration | null) ?? null;
}

/** Strip HTML to a single clean plain-text line (for titles/task text). */
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ?? "https://alvasiweb.vercel.app"
  ).replace(/\/$/, "");
}

async function markSync(
  orderId: string,
  patch: Record<string, unknown>,
  bumpAttempts = false,
) {
  const admin = createAdminClient();
  if (bumpAttempts) {
    const { data } = await admin
      .from("jamespro_sync")
      .select("attempts")
      .eq("order_id", orderId)
      .maybeSingle();
    patch.attempts = (data?.attempts ?? 0) + 1;
  }
  patch.updated_at = new Date().toISOString();
  await admin
    .from("jamespro_sync")
    .upsert({ order_id: orderId, ...patch }, { onConflict: "order_id" });
}

/**
 * Create the JamesPRO project + task for one order. Records the outcome in
 * jamespro_sync. Never throws — returns the result so callers can ignore it.
 */
export async function processOrderSync(
  orderId: string,
  opts?: { force?: boolean },
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();

  try {
    const integration = await getIntegration();
    if (!integration?.auth_key || !integration.auth_secret) {
      const error = "JamesPRO is niet verbonden.";
      if (opts?.force) await markSync(orderId, { status: "error", last_error: error });
      return { ok: false, error };
    }
    // The enabled toggle only gates automatic syncing; a manual test (force)
    // works regardless so you can verify before going live.
    if (!integration.enabled && !opts?.force) {
      return { ok: false, error: "Koppeling staat uit." };
    }

    const { data: order } = await admin
      .from("orders")
      .select(
        "id, order_number, total, created_at, note, request_reason, ordered_by, ship_to_name, ship_to_address, ship_to_postal, ship_to_city, company:companies(name, jamespro_company_id, jamespro_contact_id), items:order_items(product_name, variant_label, quantity, line_total)",
      )
      .eq("id", orderId)
      .maybeSingle();

    if (!order) {
      const error = "Bestelling niet gevonden.";
      await markSync(orderId, { status: "error", last_error: error }, true);
      return { ok: false, error };
    }

    const company = order.company as unknown as {
      name: string;
      jamespro_company_id: number | null;
      jamespro_contact_id: number | null;
    } | null;

    if (!company?.jamespro_company_id) {
      const error = "Bedrijf niet gekoppeld aan een JamesPRO-relatie.";
      await markSync(orderId, { status: "error", last_error: error }, true);
      return { ok: false, error };
    }

    const { data: orderer } = await admin
      .from("profiles")
      .select("full_name, email")
      .eq("id", order.ordered_by)
      .maybeSingle();

    const tokens = buildOrderTokens({
      orderId: order.id,
      orderNumber: order.order_number,
      companyName: company.name,
      orderedBy: orderer?.full_name ?? orderer?.email ?? "Onbekend",
      total: Number(order.total ?? 0),
      createdAt: order.created_at,
      items: (order.items ?? []) as never,
      shipTo: {
        name: order.ship_to_name,
        address: order.ship_to_address,
        postal: order.ship_to_postal,
        city: order.ship_to_city,
      },
      note: order.note,
      requestReason: order.request_reason,
      appUrl: appUrl(),
    });

    const creds: JamesproCreds = {
      key: integration.auth_key,
      secret: integration.auth_secret,
    };

    const today = new Date().toISOString().slice(0, 10);
    // Only send a configured assignee when it's a real (positive) id. Sending
    // user_id: 0 orphans the project to a non-existent user (invisible in
    // JamesPRO). When omitted, JamesPRO auto-assigns the connected account.
    const configured =
      integration.default_user_id && integration.default_user_id > 0
        ? integration.default_user_id
        : undefined;

    const project = await jamesproCreateProject(creds, {
      // The project title must be a short, plain-text line (no HTML).
      name: stripHtml(
        renderTemplate(
          integration.project_title_template ||
            DEFAULT_TEMPLATES.project_title_template,
          tokens,
        ),
      ).slice(0, 200),
      briefing: renderTemplate(
        integration.project_briefing_template ||
          DEFAULT_TEMPLATES.project_briefing_template,
        tokens,
      ),
      user_id: configured,
      company_id: company.jamespro_company_id,
      contact_id: company.jamespro_contact_id ?? undefined,
      date: today,
    });

    // Mirror the project's actual assignee (PM) onto the task so they match,
    // even when JamesPRO auto-assigned it.
    let taskAssignee = configured;
    try {
      const full = await jamesproGetProject(creds, project.id);
      if (full?.user_id && full.user_id > 0) taskAssignee = full.user_id;
    } catch {
      // non-fatal
    }

    const task = await jamesproCreateTask(creds, {
      description: stripHtml(
        renderTemplate(
          integration.task_description_template ||
            DEFAULT_TEMPLATES.task_description_template,
          tokens,
        ),
      ).slice(0, 255),
      note: stripHtml(
        renderTemplate(
          integration.task_note_template || DEFAULT_TEMPLATES.task_note_template,
          tokens,
        ),
      ),
      user_id: taskAssignee,
      project_id: project.id,
      status: 0,
      date: today,
    });

    await markSync(
      orderId,
      {
        status: "success",
        jamespro_project_id: project.id,
        jamespro_task_id: task.id,
        last_error: null,
      },
      true,
    );
    return { ok: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Onbekende fout";
    await markSync(orderId, { status: "error", last_error: error }, true);
    return { ok: false, error };
  }
}

/** Process all pending/retryable rows (used by the cron route). */
export async function processSyncQueue(): Promise<{ processed: number }> {
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("jamespro_sync")
    .select("order_id, status, attempts")
    .in("status", ["pending", "error"])
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at")
    .limit(25);

  let processed = 0;
  for (const row of rows ?? []) {
    await processOrderSync(row.order_id as string);
    processed++;
  }
  return { processed };
}
