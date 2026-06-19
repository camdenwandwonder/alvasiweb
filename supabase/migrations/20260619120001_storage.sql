-- Alvasi platform — Storage buckets for product images and company logos.
-- Public read (unguessable UUID filenames); writes restricted to superadmins.

insert into storage.buckets (id, name, public)
values
  ('product-images', 'product-images', true),
  ('logos', 'logos', true)
on conflict (id) do nothing;

-- Public read of both buckets (also served via the public object endpoint).
create policy "Public read images"
  on storage.objects for select to public
  using (bucket_id in ('product-images', 'logos'));

-- Superadmins may upload / replace / delete in these buckets.
create policy "Superadmin write product-images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.is_superadmin());

create policy "Superadmin update product-images"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.is_superadmin());

create policy "Superadmin delete product-images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.is_superadmin());

create policy "Superadmin write logos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and public.is_superadmin());

create policy "Superadmin update logos"
  on storage.objects for update to authenticated
  using (bucket_id = 'logos' and public.is_superadmin());

create policy "Superadmin delete logos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and public.is_superadmin());
