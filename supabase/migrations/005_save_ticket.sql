create or replace function public.save_ticket(p jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  uid uuid := auth.uid();
  tid uuid := (p->>'id')::uuid;
  msi jsonb := nullif(p->'msi', 'null'::jsonb);
  plan_id uuid;
  first_name text;
  first_category uuid;
  item_count int;
  ticket_total numeric;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if tid is null then raise exception 'ticket id required'; end if;
  if coalesce(jsonb_array_length(p->'items'), 0) = 0 then raise exception 'ticket needs items'; end if;

  insert into public.tickets (id, user_id, purchased_on, purchased_at, store_id, payment_method_id, discount, note)
  values (tid, uid, coalesce((p->>'purchased_on')::date, current_date), (p->>'purchased_at')::time,
          (p->>'store_id')::uuid, (p->>'payment_method_id')::uuid,
          coalesce((p->>'discount')::numeric, 0), nullif(btrim(p->>'note'), ''))
  on conflict (id) do update set
    purchased_on = excluded.purchased_on,
    purchased_at = excluded.purchased_at,
    store_id = excluded.store_id,
    payment_method_id = excluded.payment_method_id,
    discount = excluded.discount,
    note = excluded.note;

  delete from public.ticket_items i
  where i.ticket_id = tid
    and i.id not in (select (x->>'id')::uuid from jsonb_array_elements(p->'items') x);

  insert into public.ticket_items (id, user_id, ticket_id, name, category_id, quantity, unit, unit_price, sort_order)
  select (x->>'id')::uuid, uid, tid, x->>'name', (x->>'category_id')::uuid,
         coalesce((x->>'quantity')::numeric, 1), coalesce(nullif(btrim(x->>'unit'), ''), 'pza'),
         (x->>'unit_price')::numeric, n::int
  from jsonb_array_elements(p->'items') with ordinality as t(x, n)
  on conflict (id) do update set
    ticket_id = excluded.ticket_id,
    name = excluded.name,
    category_id = excluded.category_id,
    quantity = excluded.quantity,
    unit = excluded.unit,
    unit_price = excluded.unit_price,
    sort_order = excluded.sort_order;

  update public.products pr
  set category_id = coalesce(i.category_id, pr.category_id), unit = i.unit
  from public.ticket_items i
  where i.ticket_id = tid and i.product_id = pr.id
    and (pr.category_id is distinct from coalesce(i.category_id, pr.category_id) or pr.unit is distinct from i.unit);

  if msi is null then
    delete from public.msi_plans m where m.ticket_id = tid;
  else
    select t.total into ticket_total from public.tickets t where t.id = tid;
    select count(*) into item_count from public.ticket_items i where i.ticket_id = tid;
    select i.name, i.category_id into first_name, first_category
    from public.ticket_items i where i.ticket_id = tid order by i.sort_order limit 1;

    insert into public.msi_plans (user_id, ticket_id, description, category_id, payment_method_id, total_amount, months, first_month)
    values (uid, tid,
            first_name || case when item_count > 1 then ' y ' || (item_count - 1) || ' más' else '' end,
            first_category, (p->>'payment_method_id')::uuid, ticket_total,
            (msi->>'months')::int, public.month_start((msi->>'first_month')::date))
    on conflict (ticket_id) do update set
      description = excluded.description,
      category_id = excluded.category_id,
      payment_method_id = excluded.payment_method_id,
      total_amount = excluded.total_amount,
      months = excluded.months,
      first_month = excluded.first_month
    returning id into plan_id;

    delete from public.obligations o
    where o.msi_plan_id = plan_id
      and not exists (select 1 from public.obligation_payments op where op.obligation_id = o.id);
  end if;

  return tid;
end $$;

revoke execute on function public.save_ticket(jsonb) from anon, public;
grant execute on function public.save_ticket(jsonb) to authenticated;
