-- Alvasi platform — authorization helpers + Row Level Security
--
-- Permissions, company scope, and superadmin status are injected into the JWT
-- by the custom access token hook (see next migration). Reading them from the
-- JWT keeps RLS checks fast (no per-row table lookups).

-- ---------------------------------------------------------------------------
-- Claim helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_superadmin()
returns boolean
language sql stable
as $$
  select coalesce((auth.jwt() ->> 'is_superadmin')::boolean, false);
$$;

create or replace function public.auth_company_id()
returns uuid
language sql stable
as $$
  select nullif(auth.jwt() ->> 'company_id', '')::uuid;
$$;

-- True if the current user's role grants `requested` (or they are superadmin).
create or replace function public.authorize(requested public.app_permission)
returns boolean
language sql stable
as $$
  select public.is_superadmin()
      or coalesce(auth.jwt() -> 'permissions' ? requested::text, false);
$$;

-- SECURITY DEFINER helper to check order ownership without tripping orders RLS
-- inside other tables' policies.
create or replace function public.owns_order(p_order_id uuid)
returns boolean
language sql stable security definer set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.orders o
    where o.id = p_order_id and o.ordered_by = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Grants — authenticated users reach tables through RLS; anon gets nothing.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.companies        enable row level security;
alter table public.roles            enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles         enable row level security;
alter table public.products         enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders           enable row level security;
alter table public.order_items      enable row level security;
alter table public.notifications    enable row level security;

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------
create policy companies_select on public.companies for select to authenticated
  using (public.is_superadmin() or id = public.auth_company_id());

create policy companies_insert on public.companies for insert to authenticated
  with check (public.is_superadmin());

create policy companies_update on public.companies for update to authenticated
  using (public.is_superadmin()
      or (id = public.auth_company_id() and public.authorize('settings.manage')))
  with check (public.is_superadmin()
      or (id = public.auth_company_id() and public.authorize('settings.manage')));

create policy companies_delete on public.companies for delete to authenticated
  using (public.is_superadmin());

-- ---------------------------------------------------------------------------
-- roles  (managers manage their own company's roles)
-- ---------------------------------------------------------------------------
create policy roles_select on public.roles for select to authenticated
  using (public.is_superadmin() or company_id = public.auth_company_id());

create policy roles_write on public.roles for all to authenticated
  using (public.is_superadmin()
      or (company_id = public.auth_company_id() and public.authorize('roles.manage')))
  with check (public.is_superadmin()
      or (company_id = public.auth_company_id() and public.authorize('roles.manage')));

-- ---------------------------------------------------------------------------
-- role_permissions
-- ---------------------------------------------------------------------------
create policy role_permissions_select on public.role_permissions for select to authenticated
  using (
    public.is_superadmin()
    or (select r.company_id from public.roles r where r.id = role_id) = public.auth_company_id()
  );

create policy role_permissions_write on public.role_permissions for all to authenticated
  using (
    public.is_superadmin()
    or (public.authorize('roles.manage')
        and (select r.company_id from public.roles r where r.id = role_id) = public.auth_company_id())
  )
  with check (
    public.is_superadmin()
    or (public.authorize('roles.manage')
        and (select r.company_id from public.roles r where r.id = role_id) = public.auth_company_id())
  );

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_select on public.profiles for select to authenticated
  using (
    public.is_superadmin()
    or id = auth.uid()
    or (company_id = public.auth_company_id() and public.authorize('users.view'))
  );

create policy profiles_insert on public.profiles for insert to authenticated
  with check (
    public.is_superadmin()
    or (company_id = public.auth_company_id() and public.authorize('users.invite'))
  );

create policy profiles_update on public.profiles for update to authenticated
  using (
    public.is_superadmin()
    or id = auth.uid()
    or (company_id = public.auth_company_id() and public.authorize('users.update'))
  )
  with check (
    public.is_superadmin()
    or id = auth.uid()
    or (company_id = public.auth_company_id() and public.authorize('users.update'))
  );

create policy profiles_delete on public.profiles for delete to authenticated
  using (
    public.is_superadmin()
    or (company_id = public.auth_company_id() and public.authorize('users.remove'))
  );

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create policy products_select on public.products for select to authenticated
  using (public.is_superadmin()
      or (company_id = public.auth_company_id() and public.authorize('products.view')));

create policy products_insert on public.products for insert to authenticated
  with check (public.is_superadmin()
      or (company_id = public.auth_company_id() and public.authorize('products.create')));

create policy products_update on public.products for update to authenticated
  using (public.is_superadmin()
      or (company_id = public.auth_company_id() and public.authorize('products.update')))
  with check (public.is_superadmin()
      or (company_id = public.auth_company_id() and public.authorize('products.update')));

create policy products_delete on public.products for delete to authenticated
  using (public.is_superadmin()
      or (company_id = public.auth_company_id() and public.authorize('products.delete')));

-- ---------------------------------------------------------------------------
-- product_variants
-- ---------------------------------------------------------------------------
create policy product_variants_select on public.product_variants for select to authenticated
  using (public.is_superadmin()
      or (company_id = public.auth_company_id() and public.authorize('products.view')));

create policy product_variants_write on public.product_variants for all to authenticated
  using (public.is_superadmin()
      or (company_id = public.auth_company_id() and public.authorize('products.update')))
  with check (public.is_superadmin()
      or (company_id = public.auth_company_id() and public.authorize('products.update')));

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create policy orders_select on public.orders for select to authenticated
  using (
    public.is_superadmin()
    or (company_id = public.auth_company_id() and public.authorize('orders.view_all'))
    or (ordered_by = auth.uid() and public.authorize('orders.view_own'))
  );

create policy orders_insert on public.orders for insert to authenticated
  with check (
    public.is_superadmin()
    or (company_id = public.auth_company_id()
        and ordered_by = auth.uid()
        and public.authorize('orders.create'))
  );

-- Managers approve/reject/fulfil; owners may cancel their own.
create policy orders_update on public.orders for update to authenticated
  using (
    public.is_superadmin()
    or (company_id = public.auth_company_id() and public.authorize('orders.approve'))
    or (ordered_by = auth.uid() and public.authorize('orders.cancel'))
  )
  with check (
    public.is_superadmin()
    or (company_id = public.auth_company_id() and public.authorize('orders.approve'))
    or (ordered_by = auth.uid() and public.authorize('orders.cancel'))
  );

-- ---------------------------------------------------------------------------
-- order_items
-- ---------------------------------------------------------------------------
create policy order_items_select on public.order_items for select to authenticated
  using (
    public.is_superadmin()
    or (company_id = public.auth_company_id()
        and (public.authorize('orders.view_all') or public.owns_order(order_id)))
  );

create policy order_items_insert on public.order_items for insert to authenticated
  with check (
    public.is_superadmin()
    or (company_id = public.auth_company_id()
        and public.authorize('orders.create')
        and public.owns_order(order_id))
  );

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create policy notifications_select on public.notifications for select to authenticated
  using (
    (scope = 'superadmin' and public.is_superadmin())
    or (scope = 'company_managers'
        and company_id = public.auth_company_id()
        and public.authorize('orders.view_all'))
  );

create policy notifications_update on public.notifications for update to authenticated
  using (
    (scope = 'superadmin' and public.is_superadmin())
    or (scope = 'company_managers'
        and company_id = public.auth_company_id()
        and public.authorize('orders.view_all'))
  )
  with check (
    (scope = 'superadmin' and public.is_superadmin())
    or (scope = 'company_managers'
        and company_id = public.auth_company_id()
        and public.authorize('orders.view_all'))
  );
-- Notifications are written only by SECURITY DEFINER triggers; no INSERT policy.
