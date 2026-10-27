-- ===========================================================================
-- Instellingen en profiel: huisstijl-icoon, startpagina, contactpersonen,
-- adresgegevens + archiveren, bestelreferentie en kostenplaats.
-- Alleen toevoegen; idempotent.
-- ===========================================================================

alter table public.companies
  add column if not exists logo_icon_url text,
  add column if not exists short_name text,
  add column if not exists welcome_text text,
  add column if not exists announcement_text text,
  add column if not exists announcement_from date,
  add column if not exists announcement_until date,
  add column if not exists contact_name text,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists alvasi_contact_name text,
  add column if not exists alvasi_contact_email text,
  add column if not exists alvasi_contact_phone text;

alter table public.company_addresses
  add column if not exists contact_name text,
  add column if not exists phone text,
  add column if not exists instructions text,
  add column if not exists archived_at timestamptz;

alter table public.orders
  add column if not exists reference text,
  add column if not exists cost_center text;
