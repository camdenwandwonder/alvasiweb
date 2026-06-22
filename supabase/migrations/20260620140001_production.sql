-- Alvasi platform — Phase D: production pipeline + artwork proofs.

-- Extend order statuses (idempotent; values are used only by the app, not here).
alter type public.order_status add value if not exists 'in_production';
alter type public.order_status add value if not exists 'shipped';
alter type public.order_status add value if not exists 'delivered';

-- Order status/production timeline.
create table if not exists public.order_events (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references public.orders (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  status     text,
  note       text,
  actor      uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_order_events_order on public.order_events (order_id);

alter table public.order_events enable row level security;

drop policy if exists order_events_select on public.order_events;
create policy order_events_select on public.order_events for select to authenticated
  using (public.is_superadmin()
      or (company_id = public.auth_company_id()
          and (public.authorize('orders.view_all') or public.owns_order(order_id))));

drop policy if exists order_events_insert on public.order_events;
create policy order_events_insert on public.order_events for insert to authenticated
  with check (public.is_superadmin()
      or (company_id = public.auth_company_id()
          and (public.authorize('orders.approve') or public.owns_order(order_id))));

-- Artwork proofs with version history.
create table if not exists public.proofs (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  company_id  uuid not null references public.companies (id) on delete cascade,
  version     integer not null default 1,
  file_url    text not null,
  status      text not null default 'pending'
    check (status in ('pending', 'approved', 'changes_requested')),
  note        text,
  uploaded_by uuid references auth.users (id) on delete set null,
  decided_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists idx_proofs_order on public.proofs (order_id);

alter table public.proofs enable row level security;

drop policy if exists proofs_select on public.proofs;
create policy proofs_select on public.proofs for select to authenticated
  using (public.is_superadmin()
      or (company_id = public.auth_company_id()
          and (public.authorize('orders.view_all') or public.owns_order(order_id))));

drop policy if exists proofs_insert on public.proofs;
create policy proofs_insert on public.proofs for insert to authenticated
  with check (public.is_superadmin());

drop policy if exists proofs_update on public.proofs;
create policy proofs_update on public.proofs for update to authenticated
  using (public.is_superadmin()
      or (company_id = public.auth_company_id()
          and (public.authorize('orders.approve') or public.owns_order(order_id))))
  with check (public.is_superadmin()
      or (company_id = public.auth_company_id()
          and (public.authorize('orders.approve') or public.owns_order(order_id))));

-- Storage bucket for proof files.
insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', true)
on conflict (id) do nothing;

drop policy if exists "Public read proofs" on storage.objects;
create policy "Public read proofs" on storage.objects for select to public
  using (bucket_id = 'proofs');

drop policy if exists "Superadmin write proofs" on storage.objects;
create policy "Superadmin write proofs" on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and public.is_superadmin());
