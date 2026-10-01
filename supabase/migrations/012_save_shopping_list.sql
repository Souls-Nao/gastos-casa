create or replace function public.save_shopping_list(p jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  uid uuid := auth.uid();
  lid uuid := (p->>'id')::uuid;
  entries jsonb := coalesce(p->'items', '[]'::jsonb);
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if lid is null then raise exception 'list id required'; end if;

  insert into public.shopping_lists (id, user_id, name, store_id, status, ticket_id)
  values (lid, uid, coalesce(nullif(btrim(p->>'name'), ''), 'Lista de compras'), (p->>'store_id')::uuid,
          coalesce(p->>'status', 'open'), (p->>'ticket_id')::uuid)
  on conflict (id) do update set
    name = excluded.name,
    store_id = excluded.store_id,
    status = excluded.status,
    ticket_id = excluded.ticket_id;

  delete from public.shopping_list_items i
  where i.list_id = lid
    and i.id not in (select (x->>'id')::uuid from jsonb_array_elements(entries) x);

  insert into public.shopping_list_items (id, user_id, list_id, name, category_id, quantity, unit, unit_price, checked, sort_order)
  select (x->>'id')::uuid, uid, lid, btrim(x->>'name'), (x->>'category_id')::uuid,
         coalesce((x->>'quantity')::numeric, 1), coalesce(nullif(btrim(x->>'unit'), ''), 'pza'),
         (x->>'unit_price')::numeric, coalesce((x->>'checked')::boolean, false), n::int
  from jsonb_array_elements(entries) with ordinality as t(x, n)
  on conflict (id) do update set
    list_id = excluded.list_id,
    name = excluded.name,
    category_id = excluded.category_id,
    quantity = excluded.quantity,
    unit = excluded.unit,
    unit_price = excluded.unit_price,
    checked = excluded.checked,
    sort_order = excluded.sort_order;

  return lid;
end $$;

revoke execute on function public.save_shopping_list(jsonb) from anon, public;
grant execute on function public.save_shopping_list(jsonb) to authenticated;
