-- Nieuw recht: bestellen namens een medewerker (alleen managers).
-- Apart bestand: een nieuwe enumwaarde is pas na commit bruikbaar.
alter type public.app_permission add value if not exists 'orders.order_for_others';
