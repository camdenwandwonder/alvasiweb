-- ===========================================================================
-- Winkel: favorieten, assortiment per functie, maattabellen, bestellen namens.
-- Alleen toevoegen; idempotent.
-- ===========================================================================

-- 1. "Bestellen namens" standaard voor functies die medewerkers mogen bewerken.
insert into public.role_permissions (role_id, permission)
select distinct rp.role_id, 'orders.order_for_others'::public.app_permission
from public.role_permissions rp
where rp.permission = 'users.update'
  and not exists (
    select 1 from public.role_permissions x
    where x.role_id = rp.role_id and x.permission = 'orders.order_for_others'
  );

-- Wie de bestelling plaatste (anders dan de medewerker bij bestellen namens).
alter table public.orders
  add column if not exists placed_by uuid references auth.users (id) on delete set null;

-- 2. Favorieten per gebruiker.
create table if not exists public.product_favorites (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);
alter table public.product_favorites enable row level security;
drop policy if exists product_favorites_own on public.product_favorites;
create policy product_favorites_own on public.product_favorites
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3. Assortiment per functie: aanbevolen producten en het starterspakket.
create table if not exists public.role_products (
  role_id    uuid not null references public.roles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  kind       text not null default 'aanbevolen' check (kind in ('aanbevolen', 'starterspakket')),
  quantity   integer not null default 1 check (quantity between 1 and 99),
  sort_order integer not null default 0,
  primary key (role_id, product_id)
);
create index if not exists role_products_company_idx on public.role_products (company_id);
alter table public.role_products enable row level security;
drop policy if exists role_products_select on public.role_products;
create policy role_products_select on public.role_products
  for select using (public.is_superadmin() or company_id = public.auth_company_id());
-- Schrijven alleen server-side na controle.

-- 4. Maattabellen: per maatsysteem (option set) of per product.
create table if not exists public.size_charts (
  id            uuid primary key default gen_random_uuid(),
  option_set_id uuid references public.option_sets (id) on delete cascade,
  product_id    uuid references public.products (id) on delete cascade,
  columns       text[] not null default '{}',
  rows          jsonb not null default '[]'::jsonb,
  note          text,
  updated_at    timestamptz not null default now(),
  check (num_nonnulls(option_set_id, product_id) = 1)
);
create unique index if not exists size_charts_set_uidx
  on public.size_charts (option_set_id) where option_set_id is not null;
create unique index if not exists size_charts_product_uidx
  on public.size_charts (product_id) where product_id is not null;
alter table public.size_charts enable row level security;
drop policy if exists size_charts_select on public.size_charts;
create policy size_charts_select on public.size_charts
  for select using (auth.uid() is not null);
-- Schrijven alleen door Alvasi, server-side.
