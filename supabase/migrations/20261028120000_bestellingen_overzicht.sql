-- ===========================================================================
-- Bestellingenoverzicht: zoeken, filteren, tellen en groeperen in de database.
-- Alleen toevoegen; idempotent. De zoekfuncties draaien met de rechten van de
-- ingelogde gebruiker (security invoker), dus de bestaande RLS blijft gelden.
-- ===========================================================================

-- 1. Functie en naam van de besteller vastleggen op het moment van bestellen,
--    zodat overzichten per functie kloppen als iemand later wisselt.
alter table public.orders
  add column if not exists role_id uuid references public.roles (id) on delete set null,
  add column if not exists role_name text,
  add column if not exists ordered_by_name text;

create or replace function public.set_order_snapshot()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_role_id   uuid;
  v_role_name text;
  v_name      text;
begin
  select p.role_id, r.name, coalesce(nullif(trim(p.full_name), ''), p.email)
    into v_role_id, v_role_name, v_name
  from public.profiles p
  left join public.roles r on r.id = p.role_id
  where p.id = NEW.ordered_by;
  NEW.role_id := coalesce(NEW.role_id, v_role_id);
  NEW.role_name := coalesce(NEW.role_name, v_role_name);
  NEW.ordered_by_name := coalesce(NEW.ordered_by_name, v_name);
  return NEW;
end;
$$;

drop trigger if exists trg_set_order_snapshot on public.orders;
create trigger trg_set_order_snapshot
  before insert on public.orders
  for each row execute function public.set_order_snapshot();

-- Bestaande bestellingen krijgen de huidige functie en naam.
update public.orders o
   set role_id = p.role_id,
       role_name = r.name,
       ordered_by_name = coalesce(nullif(trim(p.full_name), ''), p.email)
  from public.profiles p
  left join public.roles r on r.id = p.role_id
 where p.id = o.ordered_by
   and o.ordered_by_name is null;

-- 2. Indexen voor periode, status, product en vrij zoeken.
create extension if not exists pg_trgm with schema extensions;

create index if not exists idx_orders_company_created
  on public.orders (company_id, created_at desc);
create index if not exists idx_orders_company_status
  on public.orders (company_id, status);
create index if not exists idx_order_items_product
  on public.order_items (product_id);
create index if not exists idx_orders_number_trgm
  on public.orders using gin (order_number extensions.gin_trgm_ops);
create index if not exists idx_orders_name_trgm
  on public.orders using gin (ordered_by_name extensions.gin_trgm_ops);
create index if not exists idx_order_items_name_trgm
  on public.order_items using gin (product_name extensions.gin_trgm_ops);

-- 3. Hulpfuncties voor het filterobject (jsonb).
create or replace function public.jarr_uuid(j jsonb)
returns uuid[]
language sql immutable
as $$
  select case
    when j is null or jsonb_typeof(j) <> 'array' or jsonb_array_length(j) = 0 then null
    else array(select (jsonb_array_elements_text(j))::uuid)
  end;
$$;

create or replace function public.jarr_text(j jsonb)
returns text[]
language sql immutable
as $$
  select case
    when j is null or jsonb_typeof(j) <> 'array' or jsonb_array_length(j) = 0 then null
    else array(select jsonb_array_elements_text(j))
  end;
$$;

create or replace function public.like_pattern(term text)
returns text
language sql immutable
as $$
  select '%' || replace(replace(replace(term, '\', '\\'), '%', '\%'), '_', '\_') || '%';
$$;

-- 4. De zoekfunctie. Filtersleutels (allemaal optioneel):
--    company[], from, to, status[], users[], roles[], products[], categories[],
--    address ("__custom" = afwijkend adres), unit ("credits"|"euro"), min, max,
--    request, note, proof, approvers[], own, q.
--    q: komma = of; woorden binnen een groep moeten allemaal ergens voorkomen.
create or replace function public.order_search(f jsonb)
returns setof public.orders
language sql stable security invoker set search_path = public, pg_temp
as $$
  select o.*
  from public.orders o
  where (public.jarr_uuid(f -> 'company') is null or o.company_id = any (public.jarr_uuid(f -> 'company')))
    and (nullif(f ->> 'from', '') is null or o.created_at >= (f ->> 'from')::timestamptz)
    and (nullif(f ->> 'to', '') is null or o.created_at < (f ->> 'to')::timestamptz)
    and (public.jarr_text(f -> 'status') is null or o.status::text = any (public.jarr_text(f -> 'status')))
    and (public.jarr_uuid(f -> 'users') is null or o.ordered_by = any (public.jarr_uuid(f -> 'users')))
    and (public.jarr_uuid(f -> 'roles') is null or o.role_id = any (public.jarr_uuid(f -> 'roles')))
    and (public.jarr_uuid(f -> 'approvers') is null or o.approved_by = any (public.jarr_uuid(f -> 'approvers')))
    and (public.jarr_uuid(f -> 'products') is null or exists (
          select 1 from public.order_items i
          where i.order_id = o.id and i.product_id = any (public.jarr_uuid(f -> 'products'))))
    and (public.jarr_uuid(f -> 'categories') is null or exists (
          select 1 from public.order_items i
          join public.products p on p.id = i.product_id
          where i.order_id = o.id and p.category_id = any (public.jarr_uuid(f -> 'categories'))))
    and (nullif(f ->> 'address', '') is null
         or (f ->> 'address' = '__custom' and o.ship_to_custom)
         or (f ->> 'address' <> '__custom'
             and concat_ws(', ', nullif(o.ship_to_address, ''), nullif(o.ship_to_city, '')) = f ->> 'address'))
    and (nullif(f ->> 'min', '') is null or
         (case when f ->> 'unit' = 'credits' then coalesce(o.credit_total, 0) else coalesce(o.total, 0) end)
           >= (f ->> 'min')::numeric)
    and (nullif(f ->> 'max', '') is null or
         (case when f ->> 'unit' = 'credits' then coalesce(o.credit_total, 0) else coalesce(o.total, 0) end)
           <= (f ->> 'max')::numeric)
    and (coalesce((f ->> 'request')::boolean, false) = false or o.is_request)
    and (coalesce((f ->> 'note')::boolean, false) = false or coalesce(trim(o.note), '') <> '')
    and (coalesce((f ->> 'proof')::boolean, false) = false
         or exists (select 1 from public.proofs pr where pr.order_id = o.id))
    and (coalesce((f ->> 'own')::boolean, false) = false or o.ordered_by = auth.uid())
    and (nullif(trim(f ->> 'q'), '') is null or exists (
          select 1
          from unnest(string_to_array(f ->> 'q', ',')) g(grp)
          where trim(grp) <> ''
            and not exists (
              select 1
              from regexp_split_to_table(trim(grp), '\s+') w(word)
              where not coalesce((
                o.order_number ilike public.like_pattern(word)
                or o.ordered_by_name ilike public.like_pattern(word)
                or o.role_name ilike public.like_pattern(word)
                or o.note ilike public.like_pattern(word)
                or exists (
                  select 1 from public.order_items i
                  where i.order_id = o.id
                    and (i.product_name ilike public.like_pattern(word)
                         or i.variant_label ilike public.like_pattern(word)
                         or i.sku ilike public.like_pattern(word)))
                or exists (
                  select 1 from public.profiles pp
                  where pp.id = o.ordered_by and pp.email ilike public.like_pattern(word))
              ), false))));
$$;

-- Statussen die meetellen als besteed (afgewezen/geannuleerd niet).
create or replace function public.order_is_active(s public.order_status)
returns boolean
language sql immutable
as $$
  select s::text in ('pending_approval', 'approved', 'in_production', 'shipped', 'delivered', 'fulfilled');
$$;

-- 5. Samenvatting van de selectie, plus aantallen per status (zonder het
--    statusfilter) en open bestellingen ongeacht de periode.
create or replace function public.order_summary(f jsonb)
returns jsonb
language sql stable security invoker set search_path = public, pg_temp
as $$
  with sel as (select * from public.order_search(f)),
       act as (select * from sel where public.order_is_active(status)),
       base as (select status from public.order_search(f - 'status')),
       anytime as (
         select count(*) as n from public.order_search(f - 'status' - 'from' - 'to')
         where status = 'pending_approval'
       )
  select jsonb_build_object(
    'orders', (select count(*) from sel),
    'active_orders', (select count(*) from act),
    'value', coalesce((select sum(total) from act), 0),
    'credits', coalesce((select sum(credit_total) from act), 0),
    'items', coalesce((select sum(i.quantity) from public.order_items i join act on act.id = i.order_id), 0),
    'orderers', (select count(distinct ordered_by) from act),
    'pending', (select count(*) from sel where status = 'pending_approval'),
    'pending_anytime', (select n from anytime),
    'status_counts', (
      select coalesce(jsonb_object_agg(s, n), '{}'::jsonb)
      from (select status::text as s, count(*) as n from base group by 1) x
    )
  );
$$;

-- 6. Per medewerker.
create or replace function public.order_by_person(f jsonb)
returns table (
  user_id uuid,
  name text,
  role_name text,
  company_id uuid,
  orders bigint,
  items bigint,
  value numeric,
  credits numeric,
  last_at timestamptz,
  lines jsonb
)
language sql stable security invoker set search_path = public, pg_temp
as $$
  with sel as (select * from public.order_search(f)),
       per_line as (
         select s.ordered_by, i.product_name, i.variant_label, sum(i.quantity) as qty
         from sel s join public.order_items i on i.order_id = s.id
         where public.order_is_active(s.status)
         group by 1, 2, 3
       )
  select s.ordered_by,
         max(s.ordered_by_name),
         (array_agg(s.role_name order by s.created_at desc))[1],
         max(s.company_id::text)::uuid,
         count(*) filter (where public.order_is_active(s.status)),
         coalesce((select sum(l.qty) from per_line l where l.ordered_by = s.ordered_by), 0)::bigint,
         coalesce(sum(s.total) filter (where public.order_is_active(s.status)), 0),
         coalesce(sum(s.credit_total) filter (where public.order_is_active(s.status)), 0),
         max(s.created_at),
         coalesce((
           select jsonb_agg(jsonb_build_object('product', l.product_name, 'variant', l.variant_label, 'qty', l.qty)
                            order by l.qty desc, l.product_name)
           from per_line l where l.ordered_by = s.ordered_by), '[]'::jsonb)
  from sel s
  group by s.ordered_by;
$$;

-- 7. Per product en variant (maat), met wie het besteld heeft.
create or replace function public.order_by_product(f jsonb)
returns table (
  product_id uuid,
  product_name text,
  variant_label text,
  quantity bigint,
  value numeric,
  credits numeric,
  buyers jsonb
)
language sql stable security invoker set search_path = public, pg_temp
as $$
  with lines as (
         select i.product_id, i.product_name, i.variant_label, i.quantity,
                coalesce(i.line_total, 0) as value,
                coalesce(i.credit_cost, 0) * i.quantity as credits,
                s.ordered_by, s.ordered_by_name
         from public.order_search(f) s
         join public.order_items i on i.order_id = s.id
         where public.order_is_active(s.status)
       ),
       per_buyer as (
         select product_id, product_name, variant_label, ordered_by,
                max(ordered_by_name) as name, sum(quantity) as qty
         from lines group by 1, 2, 3, 4
       )
  select l.product_id, l.product_name, l.variant_label,
         sum(l.quantity)::bigint, sum(l.value), sum(l.credits),
         (select jsonb_agg(jsonb_build_object('user_id', b.ordered_by, 'name', b.name, 'qty', b.qty)
                           order by b.qty desc, b.name)
          from per_buyer b
          where b.product_id is not distinct from l.product_id
            and b.product_name = l.product_name
            and b.variant_label is not distinct from l.variant_label)
  from lines l
  group by l.product_id, l.product_name, l.variant_label;
$$;

-- 8. Keuzes voor de filters die uit de bestellingen zelf komen.
create or replace function public.order_filter_options(f jsonb)
returns jsonb
language sql stable security invoker set search_path = public, pg_temp
as $$
  with o as (
    select * from public.orders
    where public.jarr_uuid(f -> 'company') is null or company_id = any (public.jarr_uuid(f -> 'company'))
  )
  select jsonb_build_object(
    'addresses', coalesce((
      select jsonb_agg(a order by a) from (
        select distinct concat_ws(', ', nullif(ship_to_address, ''), nullif(ship_to_city, '')) as a
        from o where not coalesce(ship_to_custom, false)
      ) x where a <> ''), '[]'::jsonb),
    'has_custom', exists (select 1 from o where ship_to_custom),
    'approvers', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', coalesce(nullif(trim(p.full_name), ''), p.email)))
      from public.profiles p
      where p.id in (select distinct approved_by from o where approved_by is not null)), '[]'::jsonb)
  );
$$;

-- 9. Opgeslagen weergaven per gebruiker.
create table if not exists public.order_views (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  scope      text not null,
  name       text not null,
  query      text not null,
  created_at timestamptz not null default now()
);
create index if not exists order_views_user_idx on public.order_views (user_id, scope);
alter table public.order_views enable row level security;
drop policy if exists order_views_own on public.order_views;
create policy order_views_own on public.order_views
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
