-- ---------------------------------------------------------------------------
-- Dutch default role names (seed). The earlier dutch_roles migration only
-- renamed existing rows once; the company-creation trigger still seeded the
-- English "Personnel". This updates the trigger to seed Dutch names + Dutch
-- descriptions, and renames any remaining English rows.
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
  values (NEW.id, 'Manager', 'Volledige controle over dit bedrijf', true, false)
  returning id into v_manager;

  insert into public.role_permissions (role_id, permission)
  select v_manager, p from unnest(array[
    'products.view','products.create','products.update','products.delete',
    'orders.create','orders.view_own','orders.view_all','orders.approve','orders.cancel',
    'users.view','users.invite','users.update','users.remove',
    'roles.manage','settings.manage'
  ]::public.app_permission[]) as p;

  insert into public.roles (company_id, name, description, is_system, requires_order_approval)
  values (NEW.id, 'Personeel', 'Kan producten bekijken en bestellen', true, false)
  returning id into v_personnel;

  insert into public.role_permissions (role_id, permission)
  select v_personnel, p from unnest(array[
    'products.view','orders.create','orders.view_own'
  ]::public.app_permission[]) as p;

  return NEW;
end;
$$;

-- Rename any remaining English default roles + Dutch descriptions.
update public.roles set name = 'Personeel' where name = 'Personnel';
update public.roles set description = 'Kan producten bekijken en bestellen'
  where description = 'Can browse and order products';
update public.roles set description = 'Volledige controle over dit bedrijf'
  where description = 'Full control over this company';
