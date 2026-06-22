-- Alvasi platform — Phase C: governance (budgets + smarter approval routing).

create table if not exists public.budgets (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  scope      text not null check (scope in ('role', 'user')),
  target_id  uuid not null,
  period     text not null default 'yearly'
    check (period in ('monthly', 'quarterly', 'yearly', 'once')),
  amount     numeric(12, 2) not null,
  currency   text not null default 'EUR',
  created_at timestamptz not null default now()
);
create index if not exists idx_budgets_company on public.budgets (company_id);

alter table public.budgets enable row level security;

drop policy if exists budgets_select on public.budgets;
create policy budgets_select on public.budgets for select to authenticated
  using (public.is_superadmin() or company_id = public.auth_company_id());

drop policy if exists budgets_write on public.budgets;
create policy budgets_write on public.budgets for all to authenticated
  using (public.is_superadmin()
      or (company_id = public.auth_company_id() and public.authorize('settings.manage')))
  with check (public.is_superadmin()
      or (company_id = public.auth_company_id() and public.authorize('settings.manage')));

-- Approval routing now considers: role rule, a company €-threshold
-- (companies.settings->>'approval_over_amount'), and budget overspend.
-- Runs as SECURITY DEFINER so members can never self-approve.
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

  select nullif(c.settings ->> 'approval_over_amount', '')::numeric
    into v_threshold
  from public.companies c
  where c.id = NEW.company_id;
  if v_threshold is not null and coalesce(NEW.total, 0) > v_threshold then
    v_requires := true;
  end if;

  -- Most specific budget wins: user budget, else role budget.
  select amount into v_budget from public.budgets
   where company_id = NEW.company_id and scope = 'user' and target_id = NEW.ordered_by
   order by created_at desc limit 1;
  if v_budget is null and v_role_id is not null then
    select amount into v_budget from public.budgets
     where company_id = NEW.company_id and scope = 'role' and target_id = v_role_id
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
