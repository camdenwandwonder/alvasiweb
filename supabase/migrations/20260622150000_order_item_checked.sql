-- Per-line production check-off for the superadmin production board.
alter table public.order_items
  add column if not exists checked boolean not null default false;
