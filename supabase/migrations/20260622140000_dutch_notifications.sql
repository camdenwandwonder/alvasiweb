-- ---------------------------------------------------------------------------
-- Dutch notification text. The order-notification trigger seeded English
-- titles/bodies and an em-dash that rendered as mojibake ("‚Äî"). Translate
-- the trigger to Dutch (plain text, no em-dash) and fix existing rows.
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

  if (TG_OP = 'INSERT' and NEW.status = 'approved')
     or (TG_OP = 'UPDATE' and NEW.status = 'approved'
         and OLD.status is distinct from 'approved') then
    insert into public.notifications (scope, company_id, type, title, body, order_id)
    values ('superadmin', NEW.company_id, 'order.placed',
            'Nieuwe bestelling bij ' || coalesce(v_company_name, 'een bedrijf'),
            v_orderer || ' heeft een bestelling geplaatst.', NEW.id);
  end if;

  return NEW;
end;
$$;

-- Fix existing notifications.
update public.notifications n
   set title = 'Nieuwe bestelling bij ' || coalesce(c.name, 'een bedrijf')
  from public.companies c
 where n.company_id = c.id and n.type = 'order.placed';

update public.notifications
   set title = 'Bestelling wacht op goedkeuring'
 where type = 'order.approval_requested';

update public.notifications
   set body = replace(body,
        ' placed an order that needs your approval.',
        ' heeft een bestelling geplaatst die goedkeuring nodig heeft.')
 where body like '% placed an order that needs your approval.';

update public.notifications
   set body = replace(body, ' placed an order.', ' heeft een bestelling geplaatst.')
 where body like '% placed an order.';
