"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";
import { logAudit } from "@/lib/company-gate";
import { loadRecipient, RECIPIENT_COOKIE } from "./recipient";

/** Mark or unmark a product as favourite for the signed-in user. */
export async function toggleFavorite(
  productId: string,
  on: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user?.companyId) return { ok: false, error: "Geen toegang" };
  const supabase = await createClient();
  const { error } = on
    ? await supabase
        .from("product_favorites")
        .upsert({ user_id: user.id, product_id: productId }, { onConflict: "user_id,product_id" })
    : await supabase
        .from("product_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", productId);
  if (error) return { ok: false, error: "Opslaan mislukt." };
  return { ok: true };
}

/** Start or stop ordering on behalf of an employee (managers only). */
export async function setOrderRecipient(
  userId: string | null,
): Promise<{ ok: true; name: string | null } | { ok: false; error: string }> {
  const user = await getCurrentUser();
  if (!user?.companyId || !can(user, "orders.order_for_others"))
    return { ok: false, error: "Je mag niet namens anderen bestellen." };
  const jar = await cookies();

  if (!userId || userId === user.id) {
    jar.delete(RECIPIENT_COOKIE);
    revalidatePath("/", "layout");
    return { ok: true, name: null };
  }
  const recipient = await loadRecipient(user.companyId, userId);
  if (!recipient) return { ok: false, error: "Medewerker niet gevonden of gedeactiveerd." };

  jar.set(RECIPIENT_COOKIE, recipient.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  await logAudit({
    companyId: user.companyId,
    actor: user,
    targetType: "user",
    targetId: recipient.id,
    action: "bestellen_namens",
    summary: `${user.fullName ?? user.email ?? "Iemand"} bestelt namens ${recipient.name}.`,
  });
  revalidatePath("/", "layout");
  return { ok: true, name: recipient.name };
}
