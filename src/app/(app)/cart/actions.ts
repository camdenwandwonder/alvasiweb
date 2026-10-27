"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import { logAudit } from "@/lib/company-gate";
import { formatPrice } from "@/lib/format";
import { formatCredits } from "@/lib/ordering";
import { sendEmail } from "@/lib/email";
import { processOrderSync } from "@/lib/jamespro/sync";
import { runCart } from "@/lib/cart/evaluate";
import type { CartLineInput } from "@/lib/cart/types";
import { readOrderPrefs } from "@/lib/company-prefs";

export type CheckoutItem = CartLineInput & {
  variantLabel?: string | null;
};

export type ShipTo = {
  name?: string;
  address?: string;
  postal?: string;
  city?: string;
  country?: string;
  note?: string;
};

export type Delivery = {
  /** Selected saved company address; empty = manual entry. */
  addressId?: string | null;
  /** Manual address fields (used when addressId is empty). */
  custom?: ShipTo;
  note?: string;
  /** Order reference (e.g. a PO number), when the company uses one. */
  reference?: string;
  /** Cost centre from the company's list, when the company uses them. */
  costCenter?: string;
};

export type CheckoutResult =
  | { ok: true; orderId: string; isRequest: boolean; orderNumber: string | null }
  | { ok: false; error: string; code?: "reason_required" };

/**
 * Creates one order from the cart. All rules (availability, prices, maxima,
 * budget, approval) come from `runCart`, the same function the checkout page
 * uses for its preview, so what was shown is what happens. Prices are always
 * recomputed on the server and the order is written with the admin client.
 * Going over budget needs a written reason; going over a maximum or using a
 * custom address turns the order into a request that needs approval.
 *
 * A manager with "bestellen namens" may order for an employee (chosen via the
 * validated cookie, never from the browser): then the employee's catalogue,
 * budget and maxima apply and the order is theirs, placed by the manager.
 *
 * `clientKey` makes placing idempotent: a second submit with the same key
 * returns the first order instead of creating another one.
 */
export async function createOrderFromCart(
  items: CheckoutItem[],
  delivery: Delivery,
  options?: { reason?: string; clientKey?: string },
): Promise<CheckoutResult> {
  const user = await getCurrentUser();
  if (!user?.companyId || !can(user, "orders.create"))
    return { ok: false, error: "Geen toegang" };
  if (!items.length) return { ok: false, error: "Je winkelwagen is leeg" };

  const companyId = user.companyId;
  const admin = createAdminClient();
  const clientKey = options?.clientKey?.trim().slice(0, 100) || null;

  const existing = clientKey ? await findByKey(user.id, clientKey) : null;
  if (existing) return existing;

  // Order reference and cost centre, as the company configured them.
  const { data: companyRow } = await admin
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .maybeSingle();
  const prefs = readOrderPrefs(companyRow?.settings as Record<string, unknown> | null);
  const reference =
    prefs.reference === "off" ? null : delivery.reference?.trim().slice(0, 60) || null;
  if (prefs.reference === "required" && !reference)
    return { ok: false, error: `Vul de ${prefs.referenceLabel.toLowerCase()} in.` };
  const costCenter =
    prefs.costCenter === "off" ? null : delivery.costCenter?.trim().slice(0, 60) || null;
  if (costCenter && !prefs.costCenters.includes(costCenter))
    return { ok: false, error: "Kies een kostenplaats uit de lijst." };
  if (prefs.costCenter === "required" && !costCenter)
    return { ok: false, error: "Kies een kostenplaats." };

  // Delivery address: a saved company address is trusted; a manual address is
  // a deviation (needs approval) only when saved addresses exist.
  const note = delivery.note?.trim() || null;
  let shipTo: ShipTo = {};
  if (delivery.addressId) {
    const { data: addr } = await admin
      .from("company_addresses")
      .select("label, recipient, street, postal_code, city, country")
      .eq("id", delivery.addressId)
      .eq("company_id", companyId)
      .is("archived_at", null)
      .maybeSingle();
    if (!addr) return { ok: false, error: "Gekozen leveradres niet gevonden" };
    shipTo = {
      name: addr.recipient ?? addr.label,
      address: addr.street ?? undefined,
      postal: addr.postal_code ?? undefined,
      city: addr.city ?? undefined,
      country: addr.country ?? undefined,
    };
  } else {
    shipTo = delivery.custom ?? {};
  }

  const run = await runCart(user, items, {
    addressId: delivery.addressId ?? null,
    custom: !delivery.addressId,
  });
  if (!("evaluation" in run)) return run;
  const { recipient, orderer, settings, lines, subtotal, creditTotal, capReasons, overBudget, addressIsCustom } =
    run;

  if (run.errors.length) return { ok: false, error: run.errors[0]! };
  if (run.evaluation.blocked) return { ok: false, error: run.evaluation.blocked };

  const userReason = options?.reason?.trim() || null;
  if (overBudget && !userReason)
    return {
      ok: false,
      code: "reason_required",
      error: "Geef een reden op voor je aanvraag.",
    };

  const reasonParts: string[] = [];
  if (overBudget && userReason) reasonParts.push(userReason);
  reasonParts.push(...capReasons);
  if (addressIsCustom) {
    const addrText = [shipTo.name, shipTo.address, shipTo.postal, shipTo.city]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(", ");
    reasonParts.push(`Afwijkend leveradres${addrText ? `: ${addrText}` : ""}`);
  }
  if (run.approvalProducts.length)
    reasonParts.push(`Altijd goedkeuring: ${run.approvalProducts.join(", ")}`);
  const isRequest =
    overBudget || capReasons.length > 0 || addressIsCustom || run.approvalProducts.length > 0;
  const finalReason = reasonParts.join(" · ") || null;
  const rate = settings.creditRate;

  const { data: order, error: oErr } = await admin
    .from("orders")
    .insert({
      company_id: companyId,
      ordered_by: orderer.id,
      placed_by: user.id,
      note,
      ship_to_name: shipTo.name?.trim() || null,
      ship_to_address: shipTo.address?.trim() || null,
      ship_to_postal: shipTo.postal?.trim() || null,
      ship_to_city: shipTo.city?.trim() || null,
      ship_to_country: shipTo.country?.trim() || null,
      ship_to_custom: addressIsCustom,
      subtotal,
      total: subtotal,
      credit_total: creditTotal,
      credit_rate: settings.payment === "credits" ? rate : null,
      is_request: isRequest,
      request_reason: finalReason,
      client_key: clientKey,
      reference,
      cost_center: costCenter,
    })
    .select("id, order_number, status")
    .single();
  if (oErr || !order) {
    // A parallel submit with the same key won the race: return that order.
    if (clientKey && oErr?.code === "23505") {
      const won = await findByKey(user.id, clientKey);
      if (won) return won;
    }
    return { ok: false, error: `Bestelling mislukt: ${oErr?.message ?? "onbekend"}` };
  }

  const { error: iErr } = await admin
    .from("order_items")
    .insert(lines.map((l) => ({ order_id: order.id, company_id: companyId, ...l })));
  if (iErr) {
    // Never leave an order without lines behind.
    await admin.from("orders").delete().eq("id", order.id);
    return { ok: false, error: `Bestelregels mislukt: ${iErr.message}` };
  }

  if (recipient) {
    const manager = user.fullName ?? user.email ?? "Een manager";
    await admin.from("order_events").insert({
      order_id: order.id,
      company_id: companyId,
      actor: user.id,
      note: `Geplaatst door ${manager} namens ${recipient.name}`,
    });
    await logAudit({
      companyId,
      actor: user,
      targetType: "order",
      targetId: order.id,
      action: "bestellen_namens",
      summary: `Bestelling ${order.order_number ?? "zonder nummer"} geplaatst door ${manager} namens ${recipient.name}.`,
    });
  }

  // The cart is done: clear its server copy for this "voor wie".
  let clear = admin.from("carts").delete().eq("user_id", user.id);
  clear = recipient ? clear.eq("for_user_id", recipient.id) : clear.is("for_user_id", null);
  await clear;

  const notifyTo = process.env.ALVASI_NOTIFY_EMAIL;
  if (notifyTo) {
    const rows = lines
      .map(
        (l) =>
          `<li>${l.quantity} × ${l.product_name}${
            l.variant_label ? ` (${l.variant_label})` : ""
          } — ${formatPrice(l.line_total)}</li>`,
      )
      .join("");
    await sendEmail({
      to: notifyTo,
      subject: `${isRequest ? "Aanvraag" : "Nieuwe bestelling"} ${order.order_number ?? ""} — ${user.company?.name ?? ""}`,
      html: `<h2>${isRequest ? "Aanvraag" : "Nieuwe bestelling"} ${order.order_number ?? ""}</h2>
        <p>Bedrijf: ${user.company?.name ?? ""}<br/>Besteld door: ${orderer.name}${
          recipient ? `<br/>Geplaatst door: ${user.fullName ?? user.email ?? ""}` : ""
        }</p>
        ${finalReason ? `<p>Reden: ${finalReason}</p>` : ""}
        <ul>${rows}</ul>
        <p><strong>Totaal: ${formatPrice(subtotal)}</strong>${
          settings.payment === "credits" ? ` (${formatCredits(creditTotal)})` : ""
        }</p>`,
    });
  }

  // Orders that skip approval go straight to production and are synced to
  // JamesPRO right after the response.
  if (order.status === "in_production") {
    after(async () => {
      await processOrderSync(order.id);
    });
  }

  revalidatePath("/orders");
  revalidatePath("/approvals");
  return {
    ok: true,
    orderId: order.id,
    isRequest,
    orderNumber: (order.order_number as string | null) ?? null,
  };
}

async function findByKey(userId: string, clientKey: string): Promise<CheckoutResult | null> {
  const { data } = await createAdminClient()
    .from("orders")
    .select("id, order_number, is_request")
    .eq("placed_by", userId)
    .eq("client_key", clientKey)
    .maybeSingle();
  if (!data) return null;
  return {
    ok: true,
    orderId: data.id as string,
    isRequest: !!data.is_request,
    orderNumber: (data.order_number as string | null) ?? null,
  };
}
