-- Alvasi platform — Phase E: member size profiles + contact details.
alter table public.profiles
  add column if not exists sizes jsonb not null default '{}'::jsonb,
  add column if not exists phone text;

-- Allow company managers (settings.manage) to upload their own logo.
drop policy if exists "Manager write logos" on storage.objects;
create policy "Manager write logos" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and public.authorize('settings.manage'));

