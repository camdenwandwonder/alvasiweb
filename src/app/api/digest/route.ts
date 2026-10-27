import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { computeAllowances } from "@/lib/allowance";
import { formatAmount } from "@/lib/ordering";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function list(title: string, rows: string[]): string {
  if (!rows.length) return "";
  return `<h3 style="margin:20px 0 6px">${title} (${rows.length})</h3><ul>${rows
    .map((r) => `<li>${r}</li>`)
    .join("")}</ul>`;
}

/**
 * Monthly summary for each company's managers (everyone whose functie may
 * view the personnel): who is close to their budget, who never ordered, who
 * has no sizes yet, and how many budget requests wait. Called by the Vercel
 * cron; protected by CRON_SECRET when set. A no-op without e-mail configured.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const [{ data: companies }, { data: sizeSets }] = await Promise.all([
    admin.from("companies").select("id, name"),
    admin.from("option_sets").select("id").eq("kind", "size"),
  ]);
  const hasSizeSystems = (sizeSets ?? []).length > 0;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://alvasiweb.vercel.app").replace(/\/$/, "");

  let sent = 0;
  for (const company of companies ?? []) {
    const [{ data: people }, { data: viewers }, { data: orders }, { count: pendingRequests }] =
      await Promise.all([
        admin
          .from("profiles")
          .select("id, full_name, email, status, role_id, sizes")
          .eq("company_id", company.id)
          .eq("is_superadmin", false),
        admin
          .from("role_permissions")
          .select("role_id, role:roles!inner(company_id)")
          .eq("permission", "users.view")
          .eq("role.company_id", company.id),
        admin.from("orders").select("ordered_by").eq("company_id", company.id),
        admin
          .from("budget_requests")
          .select("id", { count: "exact", head: true })
          .eq("company_id", company.id)
          .eq("status", "pending"),
      ]);

    const active = (people ?? []).filter((p) => p.status === "active");
    const managerRoles = new Set((viewers ?? []).map((v) => v.role_id as string));
    const recipients = active
      .filter((p) => p.role_id && managerRoles.has(p.role_id) && p.email)
      .map((p) => p.email as string);
    if (!recipients.length) continue;

    const { settings, byUser } = await computeAllowances(company.id);
    const ordered = new Set((orders ?? []).map((o) => o.ordered_by as string));
    const name = (p: { full_name: string | null; email: string | null }) =>
      esc(p.full_name ?? p.email ?? "Onbekend");

    const nearLimit = active.flatMap((p) => {
      const b = byUser.get(p.id)?.budget;
      if (!b || b.total <= 0 || b.used / b.total < 0.8) return [];
      return [
        `${name(p)}: ${formatAmount(b.used, settings.payment)} van ${formatAmount(
          b.total,
          settings.payment,
        )} gebruikt`,
      ];
    });
    const neverOrdered = active.filter((p) => !ordered.has(p.id)).map(name);
    const missingSizes = hasSizeSystems
      ? active
          .filter((p) => {
            const sizes = (p.sizes as Record<string, string> | null) ?? {};
            return Object.values(sizes).every((v) => !v);
          })
          .map(name)
      : [];

    if (!nearLimit.length && !neverOrdered.length && !missingSizes.length && !pendingRequests)
      continue;

    const html = `<div style="font-family:system-ui,sans-serif;line-height:1.5">
      <h2 style="margin:0 0 4px">Maandoverzicht ${esc(company.name)}</h2>
      <p style="color:#555;margin:0 0 12px">Zo staat het personeel er deze maand voor.</p>
      ${
        pendingRequests
          ? `<p><strong>${pendingRequests} budgetaanvra${pendingRequests === 1 ? "ag wacht" : "gen wachten"}</strong> op een besluit.</p>`
          : ""
      }
      ${list("Bijna door het budget heen", nearLimit)}
      ${list("Nog nooit besteld", neverOrdered)}
      ${list("Standaardmaten ontbreken", missingSizes)}
      <p style="margin-top:20px"><a href="${appUrl}/personeel">Open de Personeel-pagina</a></p>
    </div>`;

    for (const to of recipients) {
      await sendEmail({ to, subject: `Maandoverzicht personeel — ${company.name}`, html });
      sent++;
    }
  }

  return NextResponse.json({ ok: true, sent });
}

export const GET = handle;
export const POST = handle;
