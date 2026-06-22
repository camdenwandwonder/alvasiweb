-- =========================================================================
-- Alvasi — pending database changes (storage + catalog/configuration).
-- Safe to run once or repeatedly. Paste into Supabase → SQL Editor → Run.
-- =========================================================================

-- ---------- Storage buckets + policies ----------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true), ('logos', 'logos', true)
on conflict (id) do nothing;

drop policy if exists "Public read images" on storage.objects;
create policy "Public read images" on storage.objects for select to public
  using (bucket_id in ('product-images', 'logos'));

drop policy if exists "Superadmin write product-images" on storage.objects;
create policy "Superadmin write product-images" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_superadmin());

drop policy if exists "Superadmin update product-images" on storage.objects;
create policy "Superadmin update product-images" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_superadmin());

drop policy if exists "Superadmin delete product-images" on storage.objects;
create policy "Superadmin delete product-images" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_superadmin());

drop policy if exists "Superadmin write logos" on storage.objects;
create policy "Superadmin write logos" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and public.is_superadmin());

drop policy if exists "Superadmin update logos" on storage.objects;
create policy "Superadmin update logos" on storage.objects for update to authenticated
  using (bucket_id = 'logos' and public.is_superadmin());

drop policy if exists "Superadmin delete logos" on storage.objects;
create policy "Superadmin delete logos" on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and public.is_superadmin());

-- ---------- Configuration tables ----------
create table if not exists public.option_sets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'size' check (kind in ('size', 'color', 'text')),
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.option_values (
  id uuid primary key default gen_random_uuid(),
  option_set_id uuid not null references public.option_sets (id) on delete cascade,
  value text not null,
  label text,
  swatch text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_option_values_set on public.option_values (option_set_id);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  icon text,
  parent_id uuid references public.categories (id) on delete set null,
  default_requires_approval boolean not null default false,
  default_max_quantity integer,
  default_requires_proof boolean not null default false,
  default_lead_time_days integer,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.category_option_sets (
  category_id uuid not null references public.categories (id) on delete cascade,
  option_set_id uuid not null references public.option_sets (id) on delete cascade,
  axis_role text not null default 'option',
  required boolean not null default true,
  sort_order integer not null default 0,
  primary key (category_id, option_set_id)
);

-- ---------- Product catalog additions ----------
alter table public.products
  add column if not exists category_id uuid references public.categories (id) on delete set null,
  add column if not exists status text not null default 'active',
  add column if not exists base_price numeric(12, 2),
  add column if not exists currency text not null default 'EUR',
  add column if not exists lead_time_days integer,
  add column if not exists requires_proof boolean,
  add column if not exists requires_approval_override boolean;
create index if not exists idx_products_category on public.products (category_id);
create index if not exists idx_products_status on public.products (status);

alter table public.product_variants
  add column if not exists price_override numeric(12, 2),
  add column if not exists stock integer;

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  variant_id uuid references public.product_variants (id) on delete set null,
  url text not null,
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_product_images_product on public.product_images (product_id);
create index if not exists idx_product_images_company on public.product_images (company_id);

create table if not exists public.product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  option_set_id uuid not null references public.option_sets (id) on delete cascade,
  selected_value_ids uuid[] not null default '{}',
  sort_order integer not null default 0
);
create index if not exists idx_product_options_product on public.product_options (product_id);

-- ---------- RLS ----------
alter table public.option_sets enable row level security;
alter table public.option_values enable row level security;
alter table public.categories enable row level security;
alter table public.category_option_sets enable row level security;
alter table public.product_images enable row level security;
alter table public.product_options enable row level security;

drop policy if exists config_read_option_sets on public.option_sets;
create policy config_read_option_sets on public.option_sets for select to authenticated using (true);
drop policy if exists config_write_option_sets on public.option_sets;
create policy config_write_option_sets on public.option_sets for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists config_read_option_values on public.option_values;
create policy config_read_option_values on public.option_values for select to authenticated using (true);
drop policy if exists config_write_option_values on public.option_values;
create policy config_write_option_values on public.option_values for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists config_read_categories on public.categories;
create policy config_read_categories on public.categories for select to authenticated using (true);
drop policy if exists config_write_categories on public.categories;
create policy config_write_categories on public.categories for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists config_read_cat_opts on public.category_option_sets;
create policy config_read_cat_opts on public.category_option_sets for select to authenticated using (true);
drop policy if exists config_write_cat_opts on public.category_option_sets;
create policy config_write_cat_opts on public.category_option_sets for all to authenticated
  using (public.is_superadmin()) with check (public.is_superadmin());

drop policy if exists product_images_select on public.product_images;
create policy product_images_select on public.product_images for select to authenticated
  using (public.is_superadmin()
      or (company_id = public.auth_company_id() and public.authorize('products.view')));
drop policy if exists product_images_write on public.product_images;
create policy product_images_write on public.product_images for all to authenticated
  using (public.is_superadmin()
      or (company_id = public.auth_company_id() and public.authorize('products.update')))
  with check (public.is_superadmin()
      or (company_id = public.auth_company_id() and public.authorize('products.update')));

drop policy if exists product_options_select on public.product_options;
create policy product_options_select on public.product_options for select to authenticated
  using (public.is_superadmin()
      or (company_id = public.auth_company_id() and public.authorize('products.view')));
drop policy if exists product_options_write on public.product_options;
create policy product_options_write on public.product_options for all to authenticated
  using (public.is_superadmin()
      or (company_id = public.auth_company_id() and public.authorize('products.update')))
  with check (public.is_superadmin()
      or (company_id = public.auth_company_id() and public.authorize('products.update')));

-- ---------- Seed data ----------
insert into public.option_sets (id, name, kind, description) values
  ('a0000000-0000-0000-0000-000000000001', 'Kledingmaten', 'size', 'Standaard kledingmaten'),
  ('a0000000-0000-0000-0000-000000000002', 'Standaardkleuren', 'color', 'Veelgebruikte kleuren'),
  ('a0000000-0000-0000-0000-000000000003', 'Bannerformaten', 'size', 'Veelgebruikte bannerafmetingen')
on conflict (id) do nothing;

insert into public.option_values (option_set_id, value, label, swatch, sort_order) values
  ('a0000000-0000-0000-0000-000000000001', 'S', 'S', null, 1),
  ('a0000000-0000-0000-0000-000000000001', 'M', 'M', null, 2),
  ('a0000000-0000-0000-0000-000000000001', 'L', 'L', null, 3),
  ('a0000000-0000-0000-0000-000000000001', 'XL', 'XL', null, 4),
  ('a0000000-0000-0000-0000-000000000001', 'XXL', 'XXL', null, 5),
  ('a0000000-0000-0000-0000-000000000002', 'zwart', 'Zwart', '#111111', 1),
  ('a0000000-0000-0000-0000-000000000002', 'navy', 'Navy', '#1e293b', 2),
  ('a0000000-0000-0000-0000-000000000002', 'wit', 'Wit', '#ffffff', 3),
  ('a0000000-0000-0000-0000-000000000002', 'rood', 'Rood', '#dc2626', 4),
  ('a0000000-0000-0000-0000-000000000003', '80x200', '80 × 200 cm', null, 1),
  ('a0000000-0000-0000-0000-000000000003', '100x250', '100 × 250 cm', null, 2)
on conflict do nothing;

insert into public.categories
  (id, name, slug, description, icon, default_requires_proof, default_lead_time_days, sort_order) values
  ('c0000000-0000-0000-0000-000000000001', 'Kleding', 'kleding', 'Bedrijfskleding & werkkleding', 'shirt', true, 10, 1),
  ('c0000000-0000-0000-0000-000000000002', 'Banners', 'banners', 'Grootformaat geprinte banners', 'flag', true, 7, 2),
  ('c0000000-0000-0000-0000-000000000003', 'Accessoires', 'accessoires', 'Petten, tassen en extra''s', 'package', false, 7, 3)
on conflict (id) do nothing;

insert into public.category_option_sets (category_id, option_set_id, axis_role, sort_order) values
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'size', 1),
  ('c0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'color', 2),
  ('c0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', 'size', 1)
on conflict do nothing;
