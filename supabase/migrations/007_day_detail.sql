create or replace function public.day_detail(p_day date) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'purchased_on', t.purchased_on,
    'purchased_at', t.purchased_at,
    'total', t.total,
    'discount', t.discount,
    'stores', (select jsonb_build_object('name', s.name) from public.stores s where s.id = t.store_id),
    'payment_methods', (select jsonb_build_object('name', m.name) from public.payment_methods m where m.id = t.payment_method_id),
    'msi_plans', (select jsonb_build_object('months', mp.months) from public.msi_plans mp where mp.ticket_id = t.id),
    'ticket_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', i.name,
        'category_id', i.category_id,
        'quantity', i.quantity,
        'unit', i.unit,
        'unit_price', i.unit_price,
        'amount', i.amount,
        'net_amount', round(i.amount * case when t.total + t.discount > 0 then t.total / (t.total + t.discount) else 1 end, 2)
      ) order by i.sort_order)
      from public.ticket_items i where i.ticket_id = t.id), '[]'::jsonb)
  ) order by t.purchased_at nulls last, t.created_at), '[]'::jsonb)
  from public.tickets t
  where t.purchased_on = p_day
$$;

revoke execute on function public.day_detail(date) from anon, public;
grant execute on function public.day_detail(date) to authenticated;
