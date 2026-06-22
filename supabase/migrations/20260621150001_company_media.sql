-- Alvasi — atmospheric / mockup images per company (shown on member dashboards).
-- Files reuse the existing public 'product-images' bucket.

create table if not exists public.company_media (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  url        text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_company_media_company
  on public.company_media (company_id);

alter table public.company_media enable row level security;

drop policy if exists company_media_select on public.company_media;
create policy company_media_select on public.company_media for select to authenticated
  using (public.is_superadmin() or company_id = public.auth_company_id());

drop policy if exists company_media_write on public.company_media;
create policy company_media_write on public.company_media for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());
