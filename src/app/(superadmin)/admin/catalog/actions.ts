"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/user";

async function requireSuperadmin() {
  const user = await getCurrentUser();
  if (!user?.isSuperadmin) throw new Error("Geen toegang");
  return user;
}

function num(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Single save for the whole product editor (used by autosave + the Save button).
 * Optionally regenerates the variant matrix from the selected option values.
 */
export async function saveProduct(
  productId: string,
  companyId: string,
  payload: {
    name: string;
    category_id: string | null;
    status: string;
    description: string | null;
    base_price: number | null;
    max_quantity_per_order: number | null;
    regenVariants?: boolean;
    selections?: Record<string, string[]>;
  },
) {
  await requireSuperadmin();
  const admin = createAdminClient();

  await admin
    .from("products")
    .update({
      name: payload.name?.trim() || "Naamloos product",
      category_id: payload.category_id || null,
      status: ["draft", "active", "archived"].includes(payload.status)
        ? payload.status
        : "active",
      description: payload.description?.trim() || null,
      base_price: payload.base_price,
      max_quantity_per_order: payload.max_quantity_per_order,
    })
    .eq("id", productId);

  if (payload.regenVariants) {
    const { data: product } = await admin
      .from("products")
      .select("category_id")
      .eq("id", productId)
      .single();
    const { data: catAxes } = await admin
      .from("category_option_sets")
      .select(
        "axis_role, sort_order, option_set:option_sets(id, name, kind, values:option_values(id, value, label, sort_order))",
      )
      .eq("category_id", product?.category_id ?? "")
      .order("sort_order");

    type AxisVal = { id: string; label: string };
    const axes: { setId: string; label: string; selected: AxisVal[] }[] = [];
    for (const a of catAxes ?? []) {
      const set = a.option_set as unknown as {
        id: string;
        name: string;
        kind: string;
        values: { id: string; value: string; label: string | null; sort_order: number }[];
      };
      const chosen = payload.selections?.[set.id] ?? [];
      if (!chosen.length) continue;
      const axisLabel =
        a.axis_role === "size" ? "Maat" : a.axis_role === "color" ? "Kleur" : set.name;
      const selected = set.values
        .filter((v) => chosen.includes(v.id))
        .sort((x, y) => x.sort_order - y.sort_order)
        .map((v) => ({ id: v.id, label: v.label ?? v.value }));
      axes.push({ setId: set.id, label: axisLabel, selected });
    }

    await admin.from("product_options").delete().eq("product_id", productId);
    if (axes.length) {
      await admin.from("product_options").insert(
        axes.map((ax, i) => ({
          product_id: productId,
          company_id: companyId,
          option_set_id: ax.setId,
          selected_value_ids: ax.selected.map((s) => s.id),
          sort_order: i + 1,
        })),
      );
    }

    await admin.from("product_variants").delete().eq("product_id", productId);
    let combos: Record<string, string>[] = [{}];
    for (const ax of axes) {
      const next: Record<string, string>[] = [];
      for (const combo of combos)
        for (const val of ax.selected) next.push({ ...combo, [ax.label]: val.label });
      combos = next;
    }
    if (axes.length && combos.length) {
      await admin.from("product_variants").insert(
        combos.map((attributes) => ({
          product_id: productId,
          company_id: companyId,
          attributes,
          active: true,
        })),
      );
    }
  }

  revalidatePath(`/admin/catalog/${productId}`);
  revalidatePath("/admin/catalog");
}

export async function addProductImageUrl(
  productId: string,
  companyId: string,
  url: string,
) {
  await requireSuperadmin();
  const admin = createAdminClient();
  const { count } = await admin
    .from("product_images")
    .select("*", { count: "exact", head: true })
    .eq("product_id", productId);
  await admin.from("product_images").insert({
    product_id: productId,
    company_id: companyId,
    url,
    sort_order: (count ?? 0) + 1,
    is_primary: (count ?? 0) === 0,
  });
  revalidatePath(`/admin/catalog/${productId}`);
}

export async function createProductDraft(formData: FormData) {
  const user = await requireSuperadmin();
  const admin = createAdminClient();

  const name = String(formData.get("name") ?? "").trim();
  const companyId = String(formData.get("company_id") ?? "");
  const categoryId = String(formData.get("category_id") ?? "") || null;
  if (!name || !companyId) throw new Error("Naam en bedrijf zijn verplicht");

  const { data, error } = await admin
    .from("products")
    .insert({
      company_id: companyId,
      name,
      category_id: categoryId,
      status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  redirect(`/admin/catalog/${data.id}`);
}

export async function updateProductBasics(id: string, formData: FormData) {
  await requireSuperadmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("products")
    .update({
      name: String(formData.get("name") ?? "").trim(),
      category_id: String(formData.get("category_id") ?? "") || null,
      description: String(formData.get("description") ?? "").trim() || null,
      status: String(formData.get("status") ?? "active"),
      base_price: num(formData.get("base_price")),
      max_quantity_per_order: num(formData.get("max_quantity_per_order")),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/catalog/${id}`);
  revalidatePath("/admin/catalog");
}

export async function addProductImage(
  productId: string,
  companyId: string,
  formData: FormData,
) {
  await requireSuperadmin();
  const admin = createAdminClient();
  const url = String(formData.get("image_url") ?? "").trim();
  if (!url) return;

  const { count } = await admin
    .from("product_images")
    .select("*", { count: "exact", head: true })
    .eq("product_id", productId);

  const { error } = await admin.from("product_images").insert({
    product_id: productId,
    company_id: companyId,
    url,
    sort_order: (count ?? 0) + 1,
    is_primary: (count ?? 0) === 0,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/catalog/${productId}`);
}

export async function removeProductImage(id: string, productId: string) {
  await requireSuperadmin();
  const admin = createAdminClient();
  await admin.from("product_images").delete().eq("id", id);
  revalidatePath(`/admin/catalog/${productId}`);
}

export async function setPrimaryImage(id: string, productId: string) {
  await requireSuperadmin();
  const admin = createAdminClient();
  await admin
    .from("product_images")
    .update({ is_primary: false })
    .eq("product_id", productId);
  await admin.from("product_images").update({ is_primary: true }).eq("id", id);
  revalidatePath(`/admin/catalog/${productId}`);
}

/**
 * Save which standard option values a product offers, then (re)generate the
 * variant matrix as the cartesian product of the selected values per axis.
 */
export async function saveProductOptions(
  productId: string,
  companyId: string,
  formData: FormData,
) {
  await requireSuperadmin();
  const admin = createAdminClient();

  // Load the option sets that apply, with their values.
  const { data: product } = await admin
    .from("products")
    .select("category_id")
    .eq("id", productId)
    .single();

  const { data: catAxes } = await admin
    .from("category_option_sets")
    .select(
      "axis_role, sort_order, option_set:option_sets(id, name, kind, values:option_values(id, value, label, sort_order))",
    )
    .eq("category_id", product?.category_id ?? "")
    .order("sort_order");

  type Axis = {
    setId: string;
    label: string;
    selected: { id: string; label: string }[];
  };
  const axes: Axis[] = [];

  for (const a of catAxes ?? []) {
    const set = a.option_set as unknown as {
      id: string;
      name: string;
      kind: string;
      values: { id: string; value: string; label: string | null; sort_order: number }[];
    };
    const chosen = formData.getAll(`opt_${set.id}`).map(String);
    if (!chosen.length) continue;
    const axisLabel =
      a.axis_role === "size" ? "Maat" : a.axis_role === "color" ? "Kleur" : set.name;
    const selected = set.values
      .filter((v) => chosen.includes(v.id))
      .sort((x, y) => x.sort_order - y.sort_order)
      .map((v) => ({ id: v.id, label: v.label ?? v.value }));
    axes.push({ setId: set.id, label: axisLabel, selected });
  }

  // Persist selected option values per set.
  await admin.from("product_options").delete().eq("product_id", productId);
  if (axes.length) {
    await admin.from("product_options").insert(
      axes.map((ax, i) => ({
        product_id: productId,
        company_id: companyId,
        option_set_id: ax.setId,
        selected_value_ids: ax.selected.map((s) => s.id),
        sort_order: i + 1,
      })),
    );
  }

  // Regenerate variants = cartesian product of axis selections.
  await admin.from("product_variants").delete().eq("product_id", productId);
  let combos: Record<string, string>[] = [{}];
  for (const ax of axes) {
    const next: Record<string, string>[] = [];
    for (const combo of combos) {
      for (const val of ax.selected) {
        next.push({ ...combo, [ax.label]: val.label });
      }
    }
    combos = next;
  }
  if (axes.length && combos.length) {
    await admin.from("product_variants").insert(
      combos.map((attributes) => ({
        product_id: productId,
        company_id: companyId,
        attributes,
        active: true,
      })),
    );
  }

  revalidatePath(`/admin/catalog/${productId}`);
}

export async function duplicateProduct(id: string) {
  const user = await requireSuperadmin();
  const admin = createAdminClient();
  const { data: p } = await admin.from("products").select("*").eq("id", id).single();
  if (!p) throw new Error("Niet gevonden");

  const { data: copy } = await admin
    .from("products")
    .insert({
      company_id: p.company_id,
      name: `${p.name} (kopie)`,
      category_id: p.category_id,
      description: p.description,
      base_price: p.base_price,
      currency: p.currency,
      max_quantity_per_order: p.max_quantity_per_order,
      requires_proof: p.requires_proof,
      requires_approval_override: p.requires_approval_override,
      lead_time_days: p.lead_time_days,
      status: "draft",
      created_by: user.id,
    })
    .select("id")
    .single();

  revalidatePath("/admin/catalog");
  if (copy) redirect(`/admin/catalog/${copy.id}`);
}

export async function setProductStatus(id: string, status: string) {
  await requireSuperadmin();
  const admin = createAdminClient();
  await admin.from("products").update({ status }).eq("id", id);
  revalidatePath(`/admin/catalog/${id}`);
  revalidatePath("/admin/catalog");
}

export async function deleteProduct(id: string) {
  await requireSuperadmin();
  const admin = createAdminClient();
  await admin.from("products").delete().eq("id", id);
  revalidatePath("/admin/catalog");
  redirect("/admin/catalog");
}
