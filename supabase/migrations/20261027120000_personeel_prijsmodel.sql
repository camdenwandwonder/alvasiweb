-- ===========================================================================
-- Personeel-pagina + prijsmodel (deel A: alleen toevoegen, vóór de code).
-- Idempotent: veilig om opnieuw te draaien.
-- ===========================================================================

-- 1. Bestelregels: betaling en maxima worden twee losse keuzes. De oude
--    budget_mode blijft staan zodat de nog draaiende code blijft werken.
update public.companies
   set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
         'payment_mode',
           case settings ->> 'budget_mode'
             when 'credits'  then 'credits'
             when 'quantity' then 'none'
             else 'euro'
           end,
         'caps_enabled', coalesce(settings ->> 'budget_mode', '') = 'quantity'
       )
 where not (coalesce(settings, '{}'::jsonb) ? 'payment_mode');

-- 2. Credits: afgeleid van de europrijs via een koers per organisatie.
--    products.credit_cost = vastgezette creditprijs (of handmatige afwijking).
alter table public.products
  add column if not exists credit_cost_manual boolean not null default false;
alter table public.product_variants
  add column if not exists credit_cost numeric(12, 2);
alter table public.orders
  add column if not exists credit_rate numeric(12, 4);

-- Creditwaarden die Alvasi eerder per product invulde blijven gelden, als
-- handmatige afwijking.
update public.products
   set credit_cost_manual = true
 where credit_cost is not null and credit_cost > 0 and not credit_cost_manual;

-- 3. Welkomstpakket per functie (eenmalig budget bij indiensttreding).
alter table public.roles
  add column if not exists welcome_amount numeric(12, 2);

-- 4. Extra budget: aanvragen van medewerkers + welkomstbudget.
create table if not exists public.budget_requests (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null references public.companies (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  kind          text not null default 'request' check (kind in ('request', 'welcome')),
  unit          text not null check (unit in ('euro', 'credits')),
  amount        numeric(12, 2) not null check (amount > 0),
  reason        text,
  status        text not null default 'pending'
                  check (status in ('pending', 'approved', 'declined')),
  decided_by    uuid references auth.users (id) on delete set null,
  decided_at    timestamptz,
  decision_note text,
  created_at    timestamptz not null default now()
);
create index if not exists budget_requests_company_idx
  on public.budget_requests (company_id, status, created_at desc);
create index if not exists budget_requests_user_idx
  on public.budget_requests (user_id, status);

alter table public.budget_requests enable row level security;
drop policy if exists budget_requests_select on public.budget_requests;
create policy budget_requests_select on public.budget_requests
  for select using (
    public.is_superadmin()
    or user_id = auth.uid()
    or (company_id = public.auth_company_id()
        and (public.authorize('orders.approve') or public.authorize('settings.manage')))
  );
-- Schrijven gebeurt alleen server-side (beheerclient) na controle.

-- 5. Wijzigingsgeschiedenis.
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid references public.companies (id) on delete cascade,
  actor_id    uuid references auth.users (id) on delete set null,
  actor_name  text,
  target_type text not null,
  target_id   uuid,
  action      text not null,
  summary     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists audit_log_company_idx
  on public.audit_log (company_id, created_at desc);
create index if not exists audit_log_target_idx
  on public.audit_log (target_type, target_id, created_at desc);

alter table public.audit_log enable row level security;
drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log
  for select using (
    public.is_superadmin()
    or (company_id = public.auth_company_id()
        and (public.authorize('settings.manage') or public.authorize('users.view')))
  );

-- 6. Goedkeuring bij plaatsing: functie-instelling, aanvraag (budget of
--    maximum overschreden, afwijkend adres) of de drempel. De drempel volgt de
--    eenheid van de organisatie (euro of credits). Budget- en maximumcontrole
--    gebeurt server-side bij het afrekenen (incl. extra budget en maxima) en
--    komt binnen als is_request.
create or replace function public.set_order_status_on_insert()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_role_requires boolean;
  v_threshold     numeric;
  v_payment       text;
  v_requires      boolean := false;
begin
  select r.requires_order_approval
    into v_role_requires
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = NEW.ordered_by;
  v_requires := coalesce(v_role_requires, false);

  if NEW.is_request then
    v_requires := true;
  end if;

  select nullif(c.settings ->> 'approval_over_amount', '')::numeric,
         coalesce(c.settings ->> 'payment_mode', 'euro')
    into v_threshold, v_payment
  from public.companies c
  where c.id = NEW.company_id;

  if v_threshold is not null then
    if v_payment = 'credits' then
      if coalesce(NEW.credit_total, 0) > v_threshold then v_requires := true; end if;
    elsif coalesce(NEW.total, 0) > v_threshold then
      v_requires := true;
    end if;
  end if;

  NEW.status := case when v_requires
                     then 'pending_approval'::public.order_status
                     else 'in_production'::public.order_status end;
  return NEW;
end;
$$;
