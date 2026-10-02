alter table public.units add column if not exists price_mode text not null default 'unit' check (price_mode in ('unit', 'total'));
alter table public.units add column if not exists base_unit text;
alter table public.units add column if not exists base_factor numeric(14,6) check (base_factor > 0);
alter table public.units drop constraint if exists units_base_check;
alter table public.units add constraint units_base_check check ((base_unit is null) = (base_factor is null));

update public.units u
set price_mode = 'total',
    base_unit = coalesce((select b.name from public.units b where b.user_id = u.user_id and lower(b.name) = 'kg'), 'kg'),
    base_factor = 1000
where lower(u.name) = 'g' and u.base_unit is null and u.price_mode = 'unit';

update public.units u
set price_mode = 'total',
    base_unit = coalesce((select b.name from public.units b where b.user_id = u.user_id and lower(b.name) = 'l'), 'L'),
    base_factor = 1000
where lower(u.name) = 'ml' and u.base_unit is null and u.price_mode = 'unit';

alter table public.ticket_items add column if not exists price_mode text not null default 'unit' check (price_mode in ('unit', 'total'));
alter table public.ticket_items alter column amount
  set expression as (case when price_mode = 'total' then unit_price else round(quantity * unit_price, 2) end);

alter table public.shopping_list_items add column if not exists price_mode text not null default 'unit' check (price_mode in ('unit', 'total'));

create table if not exists public.product_prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  noted_on date not null default current_date,
  price numeric(12,2) not null check (price >= 0),
  unit text not null,
  store_id uuid references public.stores(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists product_prices_product_idx on public.product_prices (product_id, noted_on);

alter table public.product_prices enable row level security;
drop policy if exists own_rows on public.product_prices;
create policy own_rows on public.product_prices for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.product_prices from anon;
grant select, insert, update, delete on public.product_prices to authenticated;

create or replace function public.tg_unit_rename() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.name <> old.name then
    update public.ticket_items set unit = new.name where user_id = new.user_id and lower(unit) = lower(old.name);
    update public.shopping_list_items set unit = new.name where user_id = new.user_id and lower(unit) = lower(old.name);
    update public.products set unit = new.name where user_id = new.user_id and lower(unit) = lower(old.name);
    update public.product_prices set unit = new.name where user_id = new.user_id and lower(unit) = lower(old.name);
    update public.units set base_unit = new.name where user_id = new.user_id and lower(base_unit) = lower(old.name);
  end if;
  return null;
end $$;

drop trigger if exists units_rename on public.units;
create trigger units_rename after update of name on public.units
for each row execute function public.tg_unit_rename();

create or replace view public.v_item_history with (security_invoker = true) as
select i.id as item_id, i.user_id, i.ticket_id, i.product_id, i.name, i.category_id,
       coalesce(c.parent_id, c.id) as top_category_id,
       i.quantity, i.unit, i.unit_price, i.amount,
       t.purchased_on, t.purchased_at, t.store_id, t.payment_method_id,
       i.price_mode,
       coalesce(u.base_unit, i.unit) as base_unit,
       i.quantity / coalesce(u.base_factor, 1) as base_quantity,
       round(i.amount / (i.quantity / coalesce(u.base_factor, 1)), 2) as base_price,
       i.created_at
from public.ticket_items i
join public.tickets t on t.id = i.ticket_id
left join public.categories c on c.id = i.category_id
left join public.units u on u.user_id = i.user_id and lower(u.name) = lower(i.unit);

drop view if exists public.v_product_stats;

create or replace view public.v_product_prices with (security_invoker = true) as
select h.item_id as id, h.user_id, h.product_id, h.purchased_on as noted_on, h.base_price as price, h.base_unit as unit,
       h.store_id, 'purchase'::text as source, h.ticket_id, h.quantity, h.unit as bought_unit, h.amount,
       null::text as note, h.created_at
from public.v_item_history h
where h.product_id is not null
union all
select m.id, m.user_id, m.product_id, m.noted_on, m.price, m.unit,
       m.store_id, 'manual'::text, null::uuid, null::numeric, null::text, null::numeric,
       m.note, m.created_at
from public.product_prices m;

create view public.v_product_stats with (security_invoker = true) as
select p.id, p.user_id, p.name, p.category_id, p.unit, p.hidden,
       s.times_bought, s.total_quantity, s.total_spent, s.last_bought_on,
       s.avg_price, s.min_price, s.max_price,
       cur.price as last_price,
       buy.store_id as last_store_id,
       r.ref_unit,
       buy.quantity as last_quantity,
       buy.unit as last_unit,
       cur.noted_on as price_on,
       cur.source as price_source
from public.products p
left join public.units u on u.user_id = p.user_id and lower(u.name) = lower(p.unit)
cross join lateral (select coalesce(u.base_unit, p.unit) as ref_unit) r
cross join lateral (
  select count(*) as times_bought,
         coalesce(sum(h.base_quantity) filter (where lower(h.base_unit) = lower(r.ref_unit)), 0) as total_quantity,
         coalesce(sum(h.amount), 0) as total_spent,
         max(h.purchased_on) as last_bought_on,
         round(avg(h.base_price) filter (where lower(h.base_unit) = lower(r.ref_unit)), 2) as avg_price,
         min(h.base_price) filter (where lower(h.base_unit) = lower(r.ref_unit)) as min_price,
         max(h.base_price) filter (where lower(h.base_unit) = lower(r.ref_unit)) as max_price
  from public.v_item_history h
  where h.product_id = p.id
) s
left join lateral (
  select x.price, x.noted_on, x.source
  from public.v_product_prices x
  where x.product_id = p.id and lower(x.unit) = lower(r.ref_unit)
  order by x.noted_on desc, x.created_at desc
  limit 1
) cur on true
left join lateral (
  select h.store_id, h.quantity, h.unit
  from public.v_item_history h
  where h.product_id = p.id
  order by h.purchased_on desc, h.purchased_at desc nulls last, h.created_at desc
  limit 1
) buy on true;

revoke all on public.v_item_history, public.v_product_prices, public.v_product_stats from anon;
grant select on public.v_item_history, public.v_product_prices, public.v_product_stats to authenticated;

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

  insert into public.ticket_items (id, user_id, ticket_id, name, category_id, quantity, unit, unit_price, price_mode, sort_order)
  select (x->>'id')::uuid, uid, tid, x->>'name', (x->>'category_id')::uuid,
         coalesce((x->>'quantity')::numeric, 1), coalesce(nullif(btrim(x->>'unit'), ''), 'pza'),
         (x->>'unit_price')::numeric, case when x->>'price_mode' = 'total' then 'total' else 'unit' end, n::int
  from jsonb_array_elements(p->'items') with ordinality as t(x, n)
  on conflict (id) do update set
    ticket_id = excluded.ticket_id,
    name = excluded.name,
    category_id = excluded.category_id,
    quantity = excluded.quantity,
    unit = excluded.unit,
    unit_price = excluded.unit_price,
    price_mode = excluded.price_mode,
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

  insert into public.shopping_list_items (id, user_id, list_id, name, category_id, quantity, unit, unit_price, price_mode, checked, sort_order)
  select (x->>'id')::uuid, uid, lid, btrim(x->>'name'), (x->>'category_id')::uuid,
         coalesce((x->>'quantity')::numeric, 1), coalesce(nullif(btrim(x->>'unit'), ''), 'pza'),
         (x->>'unit_price')::numeric, case when x->>'price_mode' = 'total' then 'total' else 'unit' end,
         coalesce((x->>'checked')::boolean, false), n::int
  from jsonb_array_elements(entries) with ordinality as t(x, n)
  on conflict (id) do update set
    list_id = excluded.list_id,
    name = excluded.name,
    category_id = excluded.category_id,
    quantity = excluded.quantity,
    unit = excluded.unit,
    unit_price = excluded.unit_price,
    price_mode = excluded.price_mode,
    checked = excluded.checked,
    sort_order = excluded.sort_order;

  return lid;
end $$;

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
        'price_mode', i.price_mode,
        'amount', i.amount,
        'net_amount', round(i.amount * case when t.total + t.discount > 0 then t.total / (t.total + t.discount) else 1 end, 2)
      ) order by i.sort_order)
      from public.ticket_items i where i.ticket_id = t.id), '[]'::jsonb)
  ) order by t.purchased_at nulls last, t.created_at), '[]'::jsonb)
  from public.tickets t
  where t.purchased_on = p_day
$$;

create or replace function public.export_rows(p_from date, p_to date) returns jsonb
language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', t.purchased_on, 'time', t.purchased_at, 'store', s.name, 'method', pm.name,
        'item', i.name, 'category', coalesce(pc.name, c.name),
        'subcategory', case when c.parent_id is not null then c.name end,
        'quantity', i.quantity, 'unit', i.unit,
        'unit_price', case when i.price_mode = 'total' then round(i.amount / i.quantity, 4) else i.unit_price end,
        'amount', i.amount,
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
      where m.moved_on between p_from and p_to), '[]'::jsonb),
    'moves', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', v.moved_on, 'from_pocket', v.from_pocket, 'to_pocket', v.to_pocket, 'amount', v.amount, 'note', v.note)
        order by v.moved_on, v.created_at)
      from public.pocket_moves v
      where v.moved_on between p_from and p_to), '[]'::jsonb)
  )
$$;

create or replace function public.backup_tables() returns text[]
language sql immutable set search_path = '' as $$
  select array[
    'categories', 'stores', 'payment_methods', 'units', 'products', 'tickets', 'ticket_items', 'msi_plans', 'incomes',
    'month_plans', 'budgets', 'recurring_expenses', 'obligations', 'obligation_payments', 'savings_goals',
    'savings_movements', 'reserve_movements', 'shopping_lists', 'shopping_list_items', 'pocket_moves', 'product_prices'
  ]
$$;

create or replace function public.restore_data(p jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare
  uid uuid := auth.uid();
  names text[] := public.backup_tables();
  tbl text;
  cols text;
  vals text;
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
    select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position),
           string_agg(case when c.is_nullable = 'NO' and c.column_default is not null
                           then format('coalesce(%I, %s)', c.column_name, c.column_default)
                           else quote_ident(c.column_name) end, ', ' order by c.ordinal_position)
    into cols, vals
    from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = tbl and c.is_generated = 'NEVER' and c.column_name <> 'user_id';
    execute format(
      'insert into public.%I (user_id, %s) select $1, %s from jsonb_populate_recordset(null::public.%I, $2)',
      tbl, cols, vals, tbl)
      using uid, coalesce(p->'tables'->tbl, '[]'::jsonb);
    get diagnostics inserted = row_count;
    counts := counts || jsonb_build_object(tbl, inserted);
  end loop;
  return counts;
end $$;

create or replace function public.seed_defaults() returns void
language plpgsql set search_path = '' as $$
declare
  uid uuid := auth.uid();
  cat jsonb;
  sub text;
  pid uuid;
  i int := 0;
  j int;
  data jsonb := '[
    {"n":"Súper y despensa","i":"shopping-cart","c":"#2E9E6B","s":["Frutas y verduras","Carnes y pescados","Lácteos y huevo","Panadería y tortillas","Abarrotes","Bebidas","Botanas y dulces","Congelados"]},
    {"n":"Limpieza y hogar","i":"spray-can","c":"#2C9FB0","s":["Limpieza","Higiene personal","Artículos para el hogar","Mantenimiento y reparaciones","Muebles y electrodomésticos"]},
    {"n":"Servicios","i":"zap","c":"#E0A526","s":["Luz","Agua","Gas","Internet","Teléfono celular","Streaming y suscripciones"]},
    {"n":"Comida fuera","i":"utensils","c":"#E0663A","s":["Restaurantes","Comida rápida","A domicilio","Cocina económica"]},
    {"n":"Transporte","i":"car","c":"#4F6BD8","s":["Gasolina","Transporte público","Uber / taxi","Estacionamiento y casetas","Mantenimiento del auto"]},
    {"n":"Salud","i":"heart-pulse","c":"#D9486B","s":["Farmacia","Consultas","Análisis y estudios","Dental","Óptica"]},
    {"n":"Escuela","i":"graduation-cap","c":"#8657C9","s":["Inscripciones y colegiaturas","Útiles y papelería","Libros","Uniformes","Transporte escolar","Material y proyectos","Copias e impresiones"]},
    {"n":"Ropa y calzado","i":"shirt","c":"#C25A9A","s":["Ropa","Calzado","Accesorios"]},
    {"n":"Mascotas","i":"paw-print","c":"#9A7448","s":["Alimento","Veterinario","Accesorios y juguetes"]},
    {"n":"Entretenimiento","i":"party-popper","c":"#3FB5E0","s":["Salidas y paseos","Cine y eventos","Videojuegos","Pasatiempos"]},
    {"n":"Cuidado personal","i":"sparkles","c":"#E58FB0","s":["Corte de cabello","Cosméticos y perfumes"]},
    {"n":"Regalos y celebraciones","i":"gift","c":"#7FA83A","s":["Cumpleaños","Fiestas y reuniones","Donaciones"]},
    {"n":"Gastos hormiga","i":"coffee","c":"#B5523B","s":["Café y refrescos","Dulces y botanas","Propinas","Pequeñas compras"]},
    {"n":"Imprevistos y otros","i":"circle-help","c":"#7D8794","s":["Imprevistos","Comisiones bancarias","Otros"]},
    {"n":"Sueldo","i":"briefcase","c":"#2E9E6B","k":"income","s":[]},
    {"n":"Negocio","i":"store","c":"#4F6BD8","k":"income","s":[]},
    {"n":"Trabajos extra","i":"hammer","c":"#E0A526","k":"income","s":[]},
    {"n":"Apoyos y becas","i":"hand-coins","c":"#8657C9","k":"income","s":[]},
    {"n":"Regalos recibidos","i":"gift","c":"#C25A9A","k":"income","s":[]},
    {"n":"Otros ingresos","i":"circle-plus","c":"#7D8794","k":"income","s":[]}
  ]';
begin
  if uid is null then raise exception 'not authenticated'; end if;

  if not exists (select 1 from public.categories where user_id = uid) then
    for cat in select value from jsonb_array_elements(data) loop
      i := i + 1;
      insert into public.categories (user_id, kind, name, icon, color, sort_order)
      values (uid, coalesce(cat->>'k', 'expense'), cat->>'n', cat->>'i', cat->>'c', i)
      returning id into pid;
      j := 0;
      for sub in select value from jsonb_array_elements_text(cat->'s') loop
        j := j + 1;
        insert into public.categories (user_id, parent_id, kind, name, color, sort_order)
        values (uid, pid, coalesce(cat->>'k', 'expense'), sub, cat->>'c', j);
      end loop;
    end loop;

    insert into public.payment_methods (user_id, name, type, sort_order) values
      (uid, 'Efectivo', 'cash', 1),
      (uid, 'Tarjeta de débito', 'debit', 2),
      (uid, 'Transferencia', 'transfer', 3),
      (uid, 'Tarjeta de crédito', 'credit', 4)
    on conflict do nothing;

    insert into public.stores (user_id, name) values
      (uid, 'Walmart'), (uid, 'Bodega Aurrera'), (uid, 'Soriana'), (uid, 'Costco'),
      (uid, 'OXXO'), (uid, 'Mercado'), (uid, 'Tianguis'), (uid, 'Farmacia')
    on conflict do nothing;
  end if;

  if not exists (select 1 from public.units where user_id = uid) then
    insert into public.units (user_id, name, sort_order, price_mode, base_unit, base_factor) values
      (uid, 'pza', 1, 'unit', null, null), (uid, 'kg', 2, 'unit', null, null), (uid, 'g', 3, 'total', 'kg', 1000),
      (uid, 'L', 4, 'unit', null, null), (uid, 'ml', 5, 'total', 'L', 1000), (uid, 'paq', 6, 'unit', null, null),
      (uid, 'caja', 7, 'unit', null, null), (uid, 'lata', 8, 'unit', null, null), (uid, 'botella', 9, 'unit', null, null),
      (uid, 'bolsa', 10, 'unit', null, null), (uid, 'docena', 11, 'unit', null, null), (uid, 'm', 12, 'unit', null, null)
    on conflict do nothing;
  end if;
end $$;

revoke execute on function public.tg_unit_rename() from anon, public;
grant execute on function public.tg_unit_rename() to authenticated;
