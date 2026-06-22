-- ---------------------------------------------------------------------------
-- Delivery addresses. Superadmin/managers define named company delivery
-- addresses and mark one as the default. Members pick one at checkout, or
-- enter a custom address — a custom (deviating) address always routes the
-- order to approval (handled in the checkout server action via is_request).
-- ---------------------------------------------------------------------------

create table if not exists public.company_addresses (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  label       text not null,
  recipient   text,
  street      text,
  postal_code text,
  city        text,
  country     text,
  is_default  boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists company_addresses_company_idx
  on public.company_addresses (company_id);

-- Keep at most one default per company: when a row is set default, unset the
-- others for the same company.
create or replace function public.company_addresses_single_default()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if NEW.is_default then
    update public.company_addresses
       set is_default = false
     where company_id = NEW.company_id
       and id <> NEW.id
       and is_default;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_company_addresses_default on public.company_addresses;
create trigger trg_company_addresses_default
  before insert or update on public.company_addresses
  for each row execute function public.company_addresses_single_default();

-- Orders: record whether a custom (deviating) delivery address was used.
alter table public.orders
  add column if not exists ship_to_custom boolean not null default false;

-- RLS ------------------------------------------------------------------------
alter table public.company_addresses enable row level security;

drop policy if exists "company_addresses_select" on public.company_addresses;
create policy "company_addresses_select" on public.company_addresses
  for select using (
    public.is_superadmin() or company_id = public.auth_company_id()
  );

drop policy if exists "company_addresses_insert" on public.company_addresses;
create policy "company_addresses_insert" on public.company_addresses
  for insert with check (
    public.is_superadmin()
    or (public.authorize('settings.manage') and company_id = public.auth_company_id())
  );

drop policy if exists "company_addresses_update" on public.company_addresses;
create policy "company_addresses_update" on public.company_addresses
  for update using (
    public.is_superadmin()
    or (public.authorize('settings.manage') and company_id = public.auth_company_id())
  ) with check (
    public.is_superadmin()
    or (public.authorize('settings.manage') and company_id = public.auth_company_id())
  );

drop policy if exists "company_addresses_delete" on public.company_addresses;
create policy "company_addresses_delete" on public.company_addresses
  for delete using (
    public.is_superadmin()
    or (public.authorize('settings.manage') and company_id = public.auth_company_id())
  );
