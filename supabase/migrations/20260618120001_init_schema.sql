-- Alvasi platform — initial schema
-- Multi-tenant B2B ordering platform. Every tenant-scoped table carries a
-- company_id so Row Level Security can isolate tenants at the database layer.

-- ---------------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------------

-- The full catalog of grantable permissions. Custom roles are built by
-- toggling these on/off per role.
create type public.app_permission as enum (
  'company.manage',     -- superadmin: create/update companies + branding, assign products
  'products.view',
  'products.create',
  'products.update',
  'products.delete',
  'orders.create',
  'orders.view_own',
  'orders.view_all',
  'orders.approve',
  'orders.cancel',
  'users.view',
  'users.invite',
  'users.update',
  'users.remove',
  'roles.manage',
  'settings.manage'
);

create type public.order_status as enum (
  'pending_approval',
  'approved',
  'rejected',
  'fulfilled',
  'cancelled'
);

create type public.profile_status as enum (
  'invited',
  'active',
  'disabled'
);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

-- A client company of Alvasi (the tenant). Holds white-label branding.
create table public.companies (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,
  logo_url        text,
  primary_color   text not null default '#0f172a',
  secondary_color text not null default '#6366f1',
  settings        jsonb not null default '{}'::jsonb,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now()
);

-- Roles are custom per company. company_id NULL = a global/system role
-- (e.g. the platform Superadmin role).
create table public.roles (
  id                       uuid primary key default gen_random_uuid(),
  company_id               uuid references public.companies (id) on delete cascade,
  name                     text not null,
  description              text,
  is_system                boolean not null default false,
  requires_order_approval  boolean not null default false,
  created_at               timestamptz not null default now()
);
-- Role names are unique within a company (and among global roles).
create unique index roles_company_name_key
  on public.roles (coalesce(company_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

-- Which permissions a role grants.
create table public.role_permissions (
  role_id    uuid not null references public.roles (id) on delete cascade,
  permission public.app_permission not null,
  primary key (role_id, permission)
);

-- App user. id mirrors auth.users.id. company_id NULL = superadmin (Alvasi staff).
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  company_id    uuid references public.companies (id) on delete cascade,
  role_id       uuid references public.roles (id) on delete set null,
  full_name     text,
  email         text,
  status        public.profile_status not null default 'invited',
  is_superadmin boolean not null default false,
  created_at    timestamptz not null default now()
);

-- A product designed/assigned to a specific company.
create table public.products (
  id                    uuid primary key default gen_random_uuid(),
  company_id            uuid not null references public.companies (id) on delete cascade,
  name                  text not null,
  description           text,
  category              text,
  image_url             text,
  sku                   text,
  active                boolean not null default true,
  max_quantity_per_order integer,
  created_by            uuid references auth.users (id) on delete set null,
  created_at            timestamptz not null default now()
);

-- Selectable options of a product (e.g. {"size":"L","color":"Navy"}).
-- company_id is denormalized to keep RLS policies index-friendly (no joins).
create table public.product_variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  attributes jsonb not null default '{}'::jsonb,
  sku        text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.orders (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies (id) on delete cascade,
  ordered_by  uuid not null references auth.users (id) on delete restrict,
  status      public.order_status not null default 'pending_approval',
  note        text,
  approved_by uuid references auth.users (id) on delete set null,
  decided_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- Line items. product/variant names + sku are snapshotted so the order log
-- stays accurate even if the product is later edited or deleted.
create table public.order_items (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid not null references public.orders (id) on delete cascade,
  company_id    uuid not null references public.companies (id) on delete cascade,
  product_id    uuid references public.products (id) on delete set null,
  variant_id    uuid references public.product_variants (id) on delete set null,
  product_name  text not null,
  variant_label text,
  sku           text,
  quantity      integer not null check (quantity > 0),
  created_at    timestamptz not null default now()
);

-- In-app notification feed (realtime). scope routes who can see it.
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  scope      text not null check (scope in ('superadmin', 'company_managers')),
  company_id uuid references public.companies (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  order_id   uuid references public.orders (id) on delete cascade,
  payload    jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes on every column referenced by RLS policies / hot foreign keys.
-- (Missing indexes on RLS-referenced columns are the #1 performance killer.)
-- ---------------------------------------------------------------------------
create index idx_roles_company            on public.roles (company_id);
create index idx_role_permissions_role    on public.role_permissions (role_id);
create index idx_profiles_company         on public.profiles (company_id);
create index idx_profiles_role            on public.profiles (role_id);
create index idx_products_company         on public.products (company_id);
create index idx_product_variants_product on public.product_variants (product_id);
create index idx_product_variants_company on public.product_variants (company_id);
create index idx_orders_company           on public.orders (company_id);
create index idx_orders_ordered_by        on public.orders (ordered_by);
create index idx_order_items_order        on public.order_items (order_id);
create index idx_order_items_company      on public.order_items (company_id);
create index idx_notifications_scope      on public.notifications (scope);
create index idx_notifications_company    on public.notifications (company_id);
