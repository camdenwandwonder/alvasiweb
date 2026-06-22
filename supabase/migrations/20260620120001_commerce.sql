-- Alvasi platform — Phase B: commerce core (order numbers, totals, ship-to).

alter table public.orders
  add column if not exists order_number text,
  add column if not exists subtotal     numeric(12, 2) not null default 0,
  add column if not exists total         numeric(12, 2) not null default 0,
  add column if not exists currency      text not null default 'EUR',
  add column if not exists ship_to_name    text,
  add column if not exists ship_to_address text,
  add column if not exists ship_to_postal  text,
  add column if not exists ship_to_city    text,
  add column if not exists ship_to_country text;

create unique index if not exists idx_orders_number on public.orders (order_number);

alter table public.order_items
  add column if not exists unit_price numeric(12, 2) not null default 0,
  add column if not exists line_total numeric(12, 2) not null default 0;

-- Human-friendly order numbers: ALV-YYYY-00001
create sequence if not exists public.order_number_seq;

create or replace function public.set_order_number()
returns trigger
language plpgsql
as $$
begin
  if NEW.order_number is null then
    NEW.order_number :=
      'ALV-' || to_char(now(), 'YYYY') || '-' ||
      lpad(nextval('public.order_number_seq')::text, 5, '0');
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_set_order_number on public.orders;
create trigger trg_set_order_number
  before insert on public.orders
  for each row execute function public.set_order_number();
