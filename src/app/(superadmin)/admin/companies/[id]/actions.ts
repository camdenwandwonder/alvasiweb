"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/user";

async function requireSuperadmin() {
  const user = await getCurrentUser();
  if (!user?.isSuperadmin) throw new Error("Not authorized");
  return user;
}

export async function updateCompany(id: string, formData: FormData) {
  await requireSuperadmin();
  const admin = createAdminClient();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Naam is verplicht");

  const update: Record<string, unknown> = {
    name,
    primary_color: String(formData.get("primary_color") || "#0f172a"),
    secondary_color: String(formData.get("secondary_color") || "#6366f1"),
  };
  const logo = String(formData.get("logo_url") ?? "").trim();
  if (logo) update.logo_url = logo;

  const { error } = await admin.from("companies").update(update).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/companies/${id}`);
  revalidatePath("/admin/companies");
}

export async function deleteCompany(id: string) {
  await requireSuperadmin();
  const admin = createAdminClient();
  const { error } = await admin.from("companies").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/companies");
  redirect("/admin/companies");
}

export async function setCompanyCategoryVisibility(
  companyId: string,
  categoryId: string,
  formData: FormData,
) {
  await requireSuperadmin();
  const admin = createAdminClient();
  const roleIds = formData.getAll("role_ids").map(String).filter(Boolean);

  await admin
    .from("category_role_visibility")
    .delete()
    .eq("company_id", companyId)
    .eq("category_id", categoryId);

  if (roleIds.length) {
    await admin.from("category_role_visibility").insert(
      roleIds.map((rid) => ({
        company_id: companyId,
        category_id: categoryId,
        role_id: rid,
      })),
    );
  }
  revalidatePath(`/admin/companies/${companyId}`);
}

function splitList(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function createProduct(companyId: string, formData: FormData) {
  const user = await requireSuperadmin();
  const admin = createAdminClient();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Product name is required");
  const description = String(formData.get("description") ?? "").trim() || null;
  const category = String(formData.get("category") ?? "").trim() || null;
  const imageUrl = String(formData.get("image_url") ?? "").trim() || null;
  const maxQtyRaw = String(formData.get("max_quantity_per_order") ?? "").trim();
  const maxQty = maxQtyRaw ? Number(maxQtyRaw) : null;

  const { data: product, error } = await admin
    .from("products")
    .insert({
      company_id: companyId,
      name,
      description,
      category,
      image_url: imageUrl,
      max_quantity_per_order:
        maxQty && Number.isFinite(maxQty) && maxQty > 0 ? maxQty : null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // Build variants from optional Sizes × Colors.
  const sizes = splitList(formData.get("sizes"));
  const colors = splitList(formData.get("colors"));
  const variants: { product_id: string; company_id: string; attributes: Record<string, string> }[] =
    [];

  if (sizes.length || colors.length) {
    const sizeList = sizes.length ? sizes : [null];
    const colorList = colors.length ? colors : [null];
    for (const size of sizeList) {
      for (const color of colorList) {
        const attributes: Record<string, string> = {};
        if (size) attributes.size = size;
        if (color) attributes.color = color;
        variants.push({
          product_id: product.id,
          company_id: companyId,
          attributes,
        });
      }
    }
  }

  if (variants.length) {
    const { error: vErr } = await admin.from("product_variants").insert(variants);
    if (vErr) throw new Error(vErr.message);
  }

  revalidatePath(`/admin/companies/${companyId}`);
}

export async function createCompanyUser(companyId: string, formData: FormData) {
  await requireSuperadmin();
  const admin = createAdminClient();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim() || null;
  const roleId = String(formData.get("role_id") ?? "");
  if (!email || !password || !roleId) {
    throw new Error("Email, password, and role are required");
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createErr) throw new Error(createErr.message);

  const { error: profErr } = await admin.from("profiles").insert({
    id: created.user.id,
    company_id: companyId,
    role_id: roleId,
    full_name: fullName,
    email,
    status: "active",
    is_superadmin: false,
  });
  if (profErr) {
    // Roll back the auth user so we don't leave an orphaned login.
    await admin.auth.admin.deleteUser(created.user.id);
    throw new Error(profErr.message);
  }

  revalidatePath(`/admin/companies/${companyId}`);
}
