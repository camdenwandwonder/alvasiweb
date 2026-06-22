-- Alvasi — route over-allowance "requests" to approval. Extends the existing
-- order-status trigger so any order flagged is_request becomes pending_approval
-- (alongside role rule, € threshold, € budget). Members can't self-approve.

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
       and o.status in ('approved', 'fulfilled', 'pending_approval');
    if (v_spend + coalesce(NEW.total, 0)) > v_budget then
      v_requires := true;
    end if;
  end if;

  NEW.status := case when v_requires
                     then 'pending_approval'::public.order_status
                     else 'approved'::public.order_status end;
  return NEW;
end;
$$;
