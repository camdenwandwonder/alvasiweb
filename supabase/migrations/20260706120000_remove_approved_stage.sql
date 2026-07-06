-- ---------------------------------------------------------------------------
-- Remove the separate "Goedgekeurd" stage. Orders that need no approval go
-- straight to production on insert; approving a pending order also moves it
-- straight to production. Existing 'approved' rows are migrated.
-- ---------------------------------------------------------------------------

-- New orders: pending_approval when a rule requires it, otherwise directly
-- in_production (was: approved).
create or replace function public.set_order_status_on_insert()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_role_requires boolean;
  v_role_id       uuid;
  v_threshold     numeric;
  v_budget        numeric;
  v_spend         numeric;
  v_requires      boolean := false;
begin
  select r.requires_order_approval, p.role_id
    into v_role_requires, v_role_id
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = NEW.ordered_by;
  v_requires := coalesce(v_role_requires, false);

  -- Over-allowance requests always need approval.
  if NEW.is_request then
    v_requires := true;
  end if;

  select nullif(c.settings ->> 'approval_over_amount', '')::numeric
    into v_threshold
  from public.companies c
  where c.id = NEW.company_id;
  if v_threshold is not null and coalesce(NEW.total, 0) > v_threshold then
    v_requires := true;
  end if;

  select amount into v_budget from public.budgets
   where company_id = NEW.company_id and scope = 'user' and target_id = NEW.ordered_by
     and kind <> 'credits'
   order by created_at desc limit 1;
  if v_budget is null and v_role_id is not null then
    select amount into v_budget from public.budgets
     where company_id = NEW.company_id and scope = 'role' and target_id = v_role_id
       and kind <> 'credits'
     order by created_at desc limit 1;
  end if;
  if v_budget is not null then
    select coalesce(sum(o.total), 0) into v_spend from public.orders o
     where o.company_id = NEW.company_id and o.ordered_by = NEW.ordered_by
       and o.status in ('pending_approval', 'approved', 'in_production',
                        'shipped', 'delivered', 'fulfilled');
    if (v_spend + coalesce(NEW.total, 0)) > v_budget then
      v_requires := true;
    end if;
  end if;

  NEW.status := case when v_requires
                     then 'pending_approval'::public.order_status
                     else 'in_production'::public.order_status end;
  return NEW;
end;
$$;

-- JamesPRO sync: enqueue when an order enters production as a fresh order
-- (insert, or approval from pending) — not when dragged back on the board.
create or replace function public.enqueue_jamespro_sync()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if (TG_OP = 'INSERT' and NEW.status = 'in_production')
     or (TG_OP = 'UPDATE' and NEW.status = 'in_production'
         and OLD.status = 'pending_approval') then
    if exists (select 1 from public.integration_jamespro where id = 1 and enabled) then
      insert into public.jamespro_sync (order_id, status)
      values (NEW.id, 'pending')
      on conflict (order_id) do nothing;
    end if;
  end if;
  return NEW;
end;
$$;

-- Notifications: superadmin hears about a new order when it enters production.
create or replace function public.handle_order_notifications()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_company_name text;
  v_orderer      text;
begin
  select name into v_company_name from public.companies where id = NEW.company_id;
  select coalesce(full_name, email, 'Een teamlid') into v_orderer
    from public.profiles where id = NEW.ordered_by;

  if (TG_OP = 'INSERT' and NEW.status = 'pending_approval')
     or (TG_OP = 'UPDATE' and NEW.status = 'pending_approval'
         and OLD.status is distinct from 'pending_approval') then
    insert into public.notifications (scope, company_id, type, title, body, order_id)
    values ('company_managers', NEW.company_id, 'order.approval_requested',
            'Bestelling wacht op goedkeuring',
            v_orderer || ' heeft een bestelling geplaatst die goedkeuring nodig heeft.',
            NEW.id);
  end if;

  if (TG_OP = 'INSERT' and NEW.status = 'in_production')
     or (TG_OP = 'UPDATE' and NEW.status = 'in_production'
         and OLD.status = 'pending_approval') then
    insert into public.notifications (scope, company_id, type, title, body, order_id)
    values ('superadmin', NEW.company_id, 'order.placed',
            'Nieuwe bestelling bij ' || coalesce(v_company_name, 'een bedrijf'),
            v_orderer || ' heeft een bestelling geplaatst.', NEW.id);
  end if;

  return NEW;
end;
$$;

-- Migrate existing rows: the approved stage no longer exists.
update public.orders set status = 'in_production' where status = 'approved';
