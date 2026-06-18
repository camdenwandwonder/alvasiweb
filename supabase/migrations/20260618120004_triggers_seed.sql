-- Alvasi platform — triggers + seed data

-- ---------------------------------------------------------------------------
-- Order status is decided by the DB, not the client, so personnel cannot
-- self-approve by sending status = 'approved'. Based on the orderer's role.
-- ---------------------------------------------------------------------------
create or replace function public.set_order_status_on_insert()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_requires boolean;
begin
  select r.requires_order_approval into v_requires
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = NEW.ordered_by;

  NEW.status := case when coalesce(v_requires, false)
                     then 'pending_approval'::public.order_status
                     else 'approved'::public.order_status end;
  return NEW;
end;
$$;

create trigger trg_set_order_status
  before insert on public.orders
  for each row execute function public.set_order_status_on_insert();

-- ---------------------------------------------------------------------------
-- Fire in-app notifications. Superadmin is notified when an order becomes
-- approved (ready to produce); managers when one needs approval.
-- ---------------------------------------------------------------------------
create or replace function public.handle_order_notifications()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_company_name text;
  v_orderer      text;
begin
  select name into v_company_name from public.companies where id = NEW.company_id;
  select coalesce(full_name, email, 'A team member') into v_orderer
    from public.profiles where id = NEW.ordered_by;

  if (TG_OP = 'INSERT' and NEW.status = 'pending_approval')
     or (TG_OP = 'UPDATE' and NEW.status = 'pending_approval'
         and OLD.status is distinct from 'pending_approval') then
    insert into public.notifications (scope, company_id, type, title, body, order_id)
    values ('company_managers', NEW.company_id, 'order.approval_requested',
            'Order awaiting approval',
            v_orderer || ' placed an order that needs your approval.', NEW.id);
  end if;

  if (TG_OP = 'INSERT' and NEW.status = 'approved')
     or (TG_OP = 'UPDATE' and NEW.status = 'approved'
         and OLD.status is distinct from 'approved') then
    insert into public.notifications (scope, company_id, type, title, body, order_id)
    values ('superadmin', NEW.company_id, 'order.placed',
            'New order — ' || coalesce(v_company_name, 'a company'),
            v_orderer || ' placed an order.', NEW.id);
  end if;

  return NEW;
end;
$$;

create trigger trg_order_notifications
  after insert or update on public.orders
  for each row execute function public.handle_order_notifications();

-- ---------------------------------------------------------------------------
-- When a company is created, seed its default Manager + Personnel roles.
-- Managers can edit these or add their own from there.
-- ---------------------------------------------------------------------------
create or replace function public.seed_company_roles()
returns trigger
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_manager   uuid;
  v_personnel uuid;
begin
  insert into public.roles (company_id, name, description, is_system, requires_order_approval)
  values (NEW.id, 'Manager', 'Full control over this company', true, false)
  returning id into v_manager;

  insert into public.role_permissions (role_id, permission)
  select v_manager, p from unnest(array[
    'products.view','products.create','products.update','products.delete',
    'orders.create','orders.view_own','orders.view_all','orders.approve','orders.cancel',
    'users.view','users.invite','users.update','users.remove',
    'roles.manage','settings.manage'
  ]::public.app_permission[]) as p;

  insert into public.roles (company_id, name, description, is_system, requires_order_approval)
  values (NEW.id, 'Personnel', 'Can browse and order products', true, false)
  returning id into v_personnel;

  insert into public.role_permissions (role_id, permission)
  select v_personnel, p from unnest(array[
    'products.view','orders.create','orders.view_own'
  ]::public.app_permission[]) as p;

  return NEW;
end;
$$;

create trigger trg_seed_company_roles
  after insert on public.companies
  for each row execute function public.seed_company_roles();

-- ---------------------------------------------------------------------------
-- Seed: the global Superadmin role (fixed id so bootstrapping can reference it).
-- Superadmins bypass permission checks via is_superadmin(), but we grant all
-- permissions for completeness.
-- ---------------------------------------------------------------------------
insert into public.roles (id, company_id, name, description, is_system, requires_order_approval)
values ('00000000-0000-0000-0000-000000000001', null, 'Superadmin',
        'Alvasi platform administrator', true, false)
on conflict (id) do nothing;

insert into public.role_permissions (role_id, permission)
select '00000000-0000-0000-0000-000000000001', p
from unnest(enum_range(null::public.app_permission)) as p
on conflict do nothing;
