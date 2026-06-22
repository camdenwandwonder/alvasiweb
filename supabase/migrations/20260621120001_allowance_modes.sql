-- Alvasi — flexible budget modes (euro / credits / quantity allotment).
-- Company mode lives in companies.settings.budget_mode (jsonb, no column).

alter table public.products
  add column if not exists credit_cost numeric(12, 2);

alter table public.budgets
  add column if not exists kind text not null default 'euro';

alter table public.orders
  add column if not exists credit_total   numeric(12, 2) not null default 0,
  add column if not exists is_request     boolean not null default false,
  add column if not exists request_reason text;

alter table public.order_items
  add column if not exists credit_cost numeric(12, 2) not null default 0;

-- Per-product quantity quotas (quantity mode).
create table if not exists public.product_allotments (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies (id) on delete cascade,
  scope        text not null check (scope in ('role', 'user')),
  target_id    uuid not null,
  product_id   uuid not null references public.products (id) on delete cascade,
  max_quantity integer not null,
  period       text not null default 'yearly'
    check (period in ('monthly', 'quarterly', 'yearly', 'once')),
  created_at   timestamptz not null default now()
);
create index if not exists idx_allotments_company
  on public.product_allotments (company_id);

alter table public.product_allotments enable row level security;

drop policy if exists allot_select on public.product_allotments;
create policy allot_select on public.product_allotments for select to authenticated
  using (public.is_superadmin() or company_id = public.auth_company_id());

drop policy if exists allot_write on public.product_allotments;
create policy allot_write on public.product_allotments for all to authenticated
  using (public.is_superadmin()
      or (company_id = public.auth_company_id() and public.authorize('settings.manage')))
  with check (public.is_superadmin()
      or (company_id = public.auth_company_id() and public.authorize('settings.manage')));
