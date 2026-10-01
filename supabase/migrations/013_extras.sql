alter table public.categories add column if not exists rule_group text check (rule_group in ('need', 'want'));

create or replace function public.export_rows(p_from date, p_to date) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', t.purchased_on, 'time', t.purchased_at, 'store', s.name, 'method', pm.name,
        'item', i.name, 'category', coalesce(pc.name, c.name),
        'subcategory', case when c.parent_id is not null then c.name end,
        'quantity', i.quantity, 'unit', i.unit, 'unit_price', i.unit_price, 'amount', i.amount,
        'ticket_discount', t.discount, 'ticket_total', t.total, 'msi_months', mp.months, 'note', t.note)
        order by t.purchased_on, t.purchased_at nulls last, t.created_at, i.sort_order)
      from public.ticket_items i
      join public.tickets t on t.id = i.ticket_id
      left join public.stores s on s.id = t.store_id
      left join public.payment_methods pm on pm.id = t.payment_method_id
      left join public.categories c on c.id = i.category_id
      left join public.categories pc on pc.id = c.parent_id
      left join public.msi_plans mp on mp.ticket_id = t.id
      where t.purchased_on between p_from and p_to), '[]'::jsonb),
    'incomes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', i.received_on, 'amount', i.amount, 'category', c.name, 'method', pm.name, 'description', i.description)
        order by i.received_on, i.created_at)
      from public.incomes i
      left join public.categories c on c.id = i.category_id
      left join public.payment_methods pm on pm.id = i.payment_method_id
      where i.received_on between p_from and p_to), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', x.paid_on, 'name', o.name, 'kind', o.kind, 'amount', x.amount, 'method', pm.name, 'note', x.note)
        order by x.paid_on, x.created_at)
      from public.obligation_payments x
      join public.obligations o on o.id = x.obligation_id
      left join public.payment_methods pm on pm.id = x.payment_method_id
      where x.paid_on between p_from and p_to), '[]'::jsonb),
    'savings', coalesce((
      select jsonb_agg(jsonb_build_object('date', m.moved_on, 'kind', m.kind, 'name', m.name, 'amount', m.amount, 'note', m.note)
        order by m.moved_on, m.created_at)
      from (
        select sm.moved_on, 'goal' as kind, g.name, sm.amount, sm.note, sm.created_at
        from public.savings_movements sm join public.savings_goals g on g.id = sm.goal_id
        union all
        select rm.moved_on, 'reserve', null, rm.amount, rm.note, rm.created_at
        from public.reserve_movements rm
      ) m
      where m.moved_on between p_from and p_to), '[]'::jsonb)
  )
$$;

create or replace function public.backup_tables() returns text[]
language sql immutable set search_path = '' as $$
  select array[
    'categories', 'stores', 'payment_methods', 'units', 'products', 'tickets', 'ticket_items', 'msi_plans', 'incomes',
    'month_plans', 'budgets', 'recurring_expenses', 'obligations', 'obligation_payments', 'savings_goals',
    'savings_movements', 'reserve_movements', 'shopping_lists', 'shopping_list_items'
  ]
$$;

create or replace function public.backup_data() returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  tbl text;
  content jsonb;
  tables jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  foreach tbl in array public.backup_tables() loop
    execute format('select coalesce(jsonb_agg(to_jsonb(x) - ''user_id''), ''[]''::jsonb) from public.%I x', tbl) into content;
    tables := tables || jsonb_build_object(tbl, content);
  end loop;
  return jsonb_build_object('app', 'gastos-casa', 'version', 1, 'exported_at', now(), 'tables', tables);
end $$;

create or replace function public.restore_data(p jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  uid uuid := auth.uid();
  names text[] := public.backup_tables();
  tbl text;
  cols text;
  inserted bigint;
  counts jsonb := '{}'::jsonb;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p->>'app' is distinct from 'gastos-casa' or jsonb_typeof(p->'tables') is distinct from 'object' then
    raise exception 'invalid backup';
  end if;

  for i in reverse array_length(names, 1)..1 loop
    execute format('delete from public.%I where user_id = $1', names[i]) using uid;
  end loop;

  foreach tbl in array names loop
    select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position) into cols
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = tbl and c.is_generated = 'NEVER' and c.column_name <> 'user_id';
    execute format(
      'insert into public.%I (user_id, %s) select $1, %s from jsonb_populate_recordset(null::public.%I, $2)',
      tbl, cols, cols, tbl)
      using uid, coalesce(p->'tables'->tbl, '[]'::jsonb);
    get diagnostics inserted = row_count;
    counts := counts || jsonb_build_object(tbl, inserted);
  end loop;
  return counts;
end $$;

revoke execute on function public.export_rows(date, date) from anon, public;
revoke execute on function public.backup_tables() from anon, public;
revoke execute on function public.backup_data() from anon, public;
revoke execute on function public.restore_data(jsonb) from anon, public;
grant execute on function public.export_rows(date, date) to authenticated;
grant execute on function public.backup_tables() to authenticated;
grant execute on function public.backup_data() to authenticated;
grant execute on function public.restore_data(jsonb) to authenticated;
