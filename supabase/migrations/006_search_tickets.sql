create extension if not exists unaccent with schema extensions;

create or replace function public.search_tickets(p jsonb) returns jsonb
language sql stable set search_path = '' as $$
  with f as (
    select nullif(p->>'from', '')::date as d_from,
           nullif(p->>'to', '')::date as d_to,
           nullif(p->>'store_id', '')::uuid as store_id,
           nullif(p->>'payment_method_id', '')::uuid as method_id,
           nullif(p->>'category_id', '')::uuid as category_id,
           '%' || extensions.unaccent(nullif(btrim(p->>'text'), '')) || '%' as pattern,
           coalesce((p->>'limit')::int, 50) as page_size,
           coalesce((p->>'offset')::int, 0) as page_start
  ),
  matched as (
    select t.id, t.purchased_on, t.purchased_at, t.created_at, t.total, t.store_id, t.payment_method_id
    from public.tickets t, f
    where (f.d_from is null or t.purchased_on >= f.d_from)
      and (f.d_to is null or t.purchased_on <= f.d_to)
      and (f.store_id is null or t.store_id = f.store_id)
      and (f.method_id is null or t.payment_method_id = f.method_id)
      and (f.category_id is null or exists (
        select 1 from public.ticket_items i
        left join public.categories c on c.id = i.category_id
        where i.ticket_id = t.id and (i.category_id = f.category_id or c.parent_id = f.category_id)))
      and (f.pattern is null
        or extensions.unaccent(coalesce(t.note, '')) ilike f.pattern
        or exists (select 1 from public.stores s where s.id = t.store_id and extensions.unaccent(s.name) ilike f.pattern)
        or exists (select 1 from public.ticket_items i where i.ticket_id = t.id and extensions.unaccent(i.name) ilike f.pattern))
  ),
  page as (
    select m.* from matched m
    order by m.purchased_on desc, m.purchased_at desc nulls last, m.created_at desc
    limit (select page_size from f) offset (select page_start from f)
  )
  select jsonb_build_object(
    'count', (select count(*) from matched),
    'total', (select coalesce(sum(total), 0) from matched),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', g.id,
        'purchased_on', g.purchased_on,
        'total', g.total,
        'stores', (select jsonb_build_object('name', s.name) from public.stores s where s.id = g.store_id),
        'payment_methods', (select jsonb_build_object('name', m.name) from public.payment_methods m where m.id = g.payment_method_id),
        'ticket_items', coalesce((select jsonb_agg(jsonb_build_object('name', i.name) order by i.sort_order)
                                  from public.ticket_items i where i.ticket_id = g.id), '[]'::jsonb),
        'msi_plans', (select jsonb_build_object('months', mp.months) from public.msi_plans mp where mp.ticket_id = g.id)
      ) order by g.purchased_on desc, g.purchased_at desc nulls last, g.created_at desc)
      from page g), '[]'::jsonb)
  )
$$;

revoke execute on function public.search_tickets(jsonb) from anon, public;
grant execute on function public.search_tickets(jsonb) to authenticated;
