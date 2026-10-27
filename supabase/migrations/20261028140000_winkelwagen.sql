-- ===========================================================================
-- Winkelwagen: bewaard op de server (per gebruiker en per "voor wie") en
-- bescherming tegen dubbel plaatsen. Alleen toevoegen; idempotent.
-- ===========================================================================

create table if not exists public.carts (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  for_user_id uuid references auth.users (id) on delete cascade,
  company_id  uuid not null references public.companies (id) on delete cascade,
  items       jsonb not null default '[]'::jsonb,
  saved       jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);
create unique index if not exists carts_user_for_uidx
  on public.carts (user_id, coalesce(for_user_id, '00000000-0000-0000-0000-000000000000'::uuid));

alter table public.carts enable row level security;
drop policy if exists carts_own on public.carts;
create policy carts_own on public.carts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Eenmalige sleutel uit de browser: een tweede inzending geeft de eerste terug.
alter table public.orders
  add column if not exists client_key text;
create unique index if not exists orders_client_key_uidx
  on public.orders (placed_by, client_key) where client_key is not null;
