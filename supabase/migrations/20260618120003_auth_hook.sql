-- Alvasi platform — Custom Access Token Hook
--
-- Runs as `supabase_auth_admin` whenever an access token is issued/refreshed,
-- injecting company_id, role_id, is_superadmin, and the role's permission list
-- into the JWT so RLS (and the app) can authorize without extra DB round-trips.
-- Enable it in the dashboard: Authentication → Hooks → Custom Access Token.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql stable
as $$
declare
  claims          jsonb;
  v_company_id    uuid;
  v_role_id       uuid;
  v_is_superadmin boolean;
  v_permissions   jsonb;
begin
  select p.company_id, p.role_id, p.is_superadmin
    into v_company_id, v_role_id, v_is_superadmin
  from public.profiles p
  where p.id = (event ->> 'user_id')::uuid;

  select coalesce(jsonb_agg(rp.permission), '[]'::jsonb)
    into v_permissions
  from public.role_permissions rp
  where rp.role_id = v_role_id;

  claims := event -> 'claims';
  claims := jsonb_set(claims, '{company_id}',    coalesce(to_jsonb(v_company_id), 'null'::jsonb));
  claims := jsonb_set(claims, '{role_id}',       coalesce(to_jsonb(v_role_id), 'null'::jsonb));
  claims := jsonb_set(claims, '{is_superadmin}', coalesce(to_jsonb(v_is_superadmin), 'false'::jsonb));
  claims := jsonb_set(claims, '{permissions}',   coalesce(v_permissions, '[]'::jsonb));

  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- Permit the auth admin to run the hook and read the tables it needs.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

grant select on public.profiles to supabase_auth_admin;
grant select on public.role_permissions to supabase_auth_admin;

create policy auth_admin_read_profiles on public.profiles
  for select to supabase_auth_admin using (true);

create policy auth_admin_read_role_permissions on public.role_permissions
  for select to supabase_auth_admin using (true);

-- Stream new notifications to subscribed clients in realtime.
alter publication supabase_realtime add table public.notifications;
