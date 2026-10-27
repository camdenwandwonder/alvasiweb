-- ===========================================================================
-- Bestellingen alleen nog via de server (deel B: pas NA uitrol van de code
-- die bestellingen met de beheerclient aanmaakt).
--
-- Voorheen kon een medewerker via de Supabase-API zelf een bestelling met een
-- zelfgekozen totaal invoegen, en met het recht "annuleren" elk veld van een
-- eigen bestelling wijzigen (ook de status, dus goedkeuring omzeilen).
-- ===========================================================================

drop policy if exists orders_insert on public.orders;
create policy orders_insert on public.orders
  for insert with check (public.is_superadmin());

drop policy if exists order_items_insert on public.order_items;
create policy order_items_insert on public.order_items
  for insert with check (public.is_superadmin());

-- Wijzigen alleen door goedkeurders binnen het eigen bedrijf (en superadmin).
-- Annuleren door de medewerker zelf loopt via een serveractie.
drop policy if exists orders_update on public.orders;
create policy orders_update on public.orders
  for update
  using (
    public.is_superadmin()
    or (company_id = public.auth_company_id() and public.authorize('orders.approve'))
  )
  with check (
    public.is_superadmin()
    or (company_id = public.auth_company_id() and public.authorize('orders.approve'))
  );
