-- ===========================================================================
-- Zoeken in bestellingen ook op bestelreferentie (bijv. PO-nummer).
-- Zelfde definitie als in 20261028120000_bestellingen_overzicht.sql, met één
-- extra zoekveld. Idempotent.
-- ===========================================================================

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
                or o.reference ilike public.like_pattern(word)
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
