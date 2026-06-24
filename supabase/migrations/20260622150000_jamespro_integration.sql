-- ---------------------------------------------------------------------------
-- JamesPRO integration. A single global connection (Alvasi owns one JamesPRO
-- account) creates a project + task per approved order on the right relation.
-- Secrets live here and are read only by the service-role admin client (RLS
-- denies everyone else).
-- ---------------------------------------------------------------------------

create table if not exists public.integration_jamespro (
  id                         int primary key default 1,
  enabled                    boolean not null default false,
  auth_key                   text,
  auth_secret                text,
  device_type                text not null default 'Alvasi',
  default_user_id            int,
  project_title_template     text,
  project_briefing_template  text,
  task_description_template  text,
  task_note_template         text,
  connected_user             jsonb,
  last_tested_at             timestamptz,
  updated_at                 timestamptz not null default now(),
  constraint integration_jamespro_singleton check (id = 1)
);

insert into public.integration_jamespro (id) values (1) on conflict do nothing;

-- RLS: enable with NO policies -> only the service-role admin client can touch it.
alter table public.integration_jamespro enable row level security;

-- Per-company relation mapping.
alter table public.companies
  add column if not exists jamespro_company_id int,
  add column if not exists jamespro_contact_id int;

-- One sync record per order (idempotency + audit).
create table if not exists public.jamespro_sync (
  order_id            uuid primary key references public.orders(id) on delete cascade,
  status              text not null default 'pending',  -- pending | success | error
  jamespro_project_id int,
  jamespro_task_id    int,
  attempts            int not null default 0,
  last_error          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists jamespro_sync_status_idx on public.jamespro_sync (status);

alter table public.jamespro_sync enable row level security;
-- Superadmin may read the log (writes happen via the admin client).
drop policy if exists "jamespro_sync_select" on public.jamespro_sync;
create policy "jamespro_sync_select" on public.jamespro_sync
  for select using (public.is_superadmin());

-- Enqueue a sync when an order becomes approved (only while the integration is on).
create or replace function public.enqueue_jamespro_sync()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if (TG_OP = 'INSERT' and NEW.status = 'approved')
     or (TG_OP = 'UPDATE' and NEW.status = 'approved'
         and OLD.status is distinct from 'approved') then
    if exists (select 1 from public.integration_jamespro where id = 1 and enabled) then
      insert into public.jamespro_sync (order_id, status)
      values (NEW.id, 'pending')
      on conflict (order_id) do nothing;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_enqueue_jamespro_sync on public.orders;
create trigger trg_enqueue_jamespro_sync
  after insert or update on public.orders
  for each row execute function public.enqueue_jamespro_sync();
