-- Alvasi platform — per-company, per-category role visibility.
-- Rows present for (company, category) = ONLY those roles see that category's
-- products. No rows for a (company, category) = visible to all company roles.

create table if not exists public.category_role_visibility (
  company_id  uuid not null references public.companies (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  role_id     uuid not null references public.roles (id) on delete cascade,
  primary key (company_id, category_id, role_id)
);
create index if not exists idx_crv_company_category
  on public.category_role_visibility (company_id, category_id);

alter table public.category_role_visibility enable row level security;

drop policy if exists crv_select on public.category_role_visibility;
create policy crv_select on public.category_role_visibility for select to authenticated
  using (public.is_superadmin() or company_id = public.auth_company_id());

drop policy if exists crv_write on public.category_role_visibility;
create policy crv_write on public.category_role_visibility for all to authenticated
  using (public.is_superadmin()
      or (company_id = public.auth_company_id() and public.authorize('settings.manage')))
  with check (public.is_superadmin()
      or (company_id = public.auth_company_id() and public.authorize('settings.manage')));
