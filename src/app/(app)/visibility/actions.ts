"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, can } from "@/lib/auth/user";

export async function setCategoryVisibility(
  categoryId: string,
  formData: FormData,
) {
  const user = await getCurrentUser();
  if (!user?.companyId || !can(user, "settings.manage"))
    throw new Error("Geen toegang");
  const supabase = await createClient();

  const roleIds = formData.getAll("role_ids").map(String).filter(Boolean);

  await supabase
    .from("category_role_visibility")
    .delete()
    .eq("company_id", user.companyId)
    .eq("category_id", categoryId);

  if (roleIds.length) {
    await supabase.from("category_role_visibility").insert(
      roleIds.map((rid) => ({
        company_id: user.companyId,
        category_id: categoryId,
        role_id: rid,
      })),
    );
  }
  revalidatePath("/visibility");
}
