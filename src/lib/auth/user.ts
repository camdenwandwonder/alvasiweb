import { createClient } from "@/lib/supabase/server";

export type Company = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
};

export type CurrentUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  companyId: string | null;
  roleId: string | null;
  roleName: string | null;
  isSuperadmin: boolean;
  permissions: string[];
  company: Company | null;
};

/**
 * Loads the authenticated user together with their profile, company branding,
 * role, and permission list. Returns null when there is no valid session.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, company_id, role_id, is_superadmin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    return {
      id: user.id,
      email: user.email ?? null,
      fullName: null,
      companyId: null,
      roleId: null,
      roleName: null,
      isSuperadmin: false,
      permissions: [],
      company: null,
    };
  }

  let permissions: string[] = [];
  let roleName: string | null = null;
  if (profile.role_id) {
    const [{ data: perms }, { data: role }] = await Promise.all([
      supabase
        .from("role_permissions")
        .select("permission")
        .eq("role_id", profile.role_id),
      supabase
        .from("roles")
        .select("name")
        .eq("id", profile.role_id)
        .maybeSingle(),
    ]);
    permissions = perms?.map((p) => p.permission as string) ?? [];
    roleName = role?.name ?? null;
  }

  let company: Company | null = null;
  if (profile.company_id) {
    const { data: c } = await supabase
      .from("companies")
      .select("id, name, slug, logo_url, primary_color, secondary_color")
      .eq("id", profile.company_id)
      .maybeSingle();
    company = (c as Company) ?? null;
  }

  return {
    id: profile.id,
    email: profile.email,
    fullName: profile.full_name,
    companyId: profile.company_id,
    roleId: profile.role_id,
    roleName,
    isSuperadmin: profile.is_superadmin,
    permissions,
    company,
  };
}

/** Permission check honoring the superadmin bypass. */
export function can(user: CurrentUser | null, permission: string): boolean {
  if (!user) return false;
  if (user.isSuperadmin) return true;
  return user.permissions.includes(permission);
}
