create or replace function public.catalog_usage(p_table text, p_id uuid) returns int
language sql stable set search_path = '' as $$
  select (case p_table
    when 'categories' then
      (select count(*) from public.ticket_items x
        where x.category_id in (select c.id from public.categories c where c.id = p_id or c.parent_id = p_id))
      + (select count(*) from public.incomes x
        where x.category_id in (select c.id from public.categories c where c.id = p_id or c.parent_id = p_id))
      + (select count(*) from public.recurring_expenses x
        where x.category_id in (select c.id from public.categories c where c.id = p_id or c.parent_id = p_id))
      + (select count(*) from public.msi_plans x
        where x.category_id in (select c.id from public.categories c where c.id = p_id or c.parent_id = p_id))
    when 'stores' then
      (select count(*) from public.tickets x where x.store_id = p_id)
    when 'payment_methods' then
      (select count(*) from public.tickets x where x.payment_method_id = p_id)
      + (select count(*) from public.incomes x where x.payment_method_id = p_id)
      + (select count(*) from public.msi_plans x where x.payment_method_id = p_id)
      + (select count(*) from public.recurring_expenses x where x.payment_method_id = p_id)
      + (select count(*) from public.obligation_payments x
        where x.payment_method_id = p_id
           or x.obligation_id in (select o.id from public.obligations o where o.card_id = p_id))
    else 0
  end)::int
$$;

revoke execute on function public.catalog_usage(text, uuid) from anon, public;
grant execute on function public.catalog_usage(text, uuid) to authenticated;
