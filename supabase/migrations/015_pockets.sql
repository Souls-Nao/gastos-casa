create table if not exists public.pocket_moves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  moved_on date not null default current_date,
  from_pocket text check (from_pocket in ('cash', 'bank')),
  to_pocket text check (to_pocket in ('cash', 'bank')),
  amount numeric(12,2) not null check (amount > 0),
  note text,
  created_at timestamptz not null default now(),
  check (coalesce(from_pocket, '') <> coalesce(to_pocket, ''))
);
create index if not exists pocket_moves_user_date_idx on public.pocket_moves (user_id, moved_on);

alter table public.pocket_moves enable row level security;
drop policy if exists own_rows on public.pocket_moves;
create policy own_rows on public.pocket_moves for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.pocket_moves from anon;
grant select, insert, update, delete on public.pocket_moves to authenticated;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'month_plans' and column_name = 'opening_balance') then
    execute $sql$
      insert into public.pocket_moves (user_id, moved_on, from_pocket, to_pocket, amount, note)
      select mp.user_id, mp.month,
             case when mp.opening_balance < 0 then 'bank' end,
             case when mp.opening_balance > 0 then 'bank' end,
             abs(mp.opening_balance), 'Saldo inicial'
      from public.month_plans mp
      where mp.opening_balance <> 0
    $sql$;
  end if;
end $$;

create or replace function public.pocket_of(p_type text) returns text
language sql immutable set search_path = '' as $$
  select case when p_type = 'credit' then null when p_type is null or p_type = 'cash' then 'cash' else 'bank' end
$$;

create or replace function public.pocket_balance(p_pocket text) returns numeric
language sql stable set search_path = '' as $$
  select
    coalesce((select sum(i.amount) from public.incomes i
              left join public.payment_methods pm on pm.id = i.payment_method_id
              where public.pocket_of(pm.type) = p_pocket), 0)
    - coalesce((select sum(t.total) from public.tickets t
                left join public.payment_methods pm on pm.id = t.payment_method_id
                where public.pocket_of(pm.type) = p_pocket), 0)
    - coalesce((select sum(x.amount) from public.obligation_payments x
                left join public.payment_methods pm on pm.id = x.payment_method_id
                where x.ticket_id is null and public.pocket_of(pm.type) = p_pocket), 0)
    + coalesce((select sum(case when v.to_pocket = p_pocket then v.amount else 0 end)
                     - sum(case when v.from_pocket = p_pocket then v.amount else 0 end)
                from public.pocket_moves v), 0)
$$;

create or replace function public.money_overview(p_month date default current_date) returns jsonb
language sql stable set search_path = '' as $$
  with b as (select public.pocket_balance('cash') as cash, public.pocket_balance('bank') as bank),
  e as (select coalesce((select sum(sm.amount) from public.savings_movements sm), 0) as savings,
               coalesce((select sum(rm.amount) from public.reserve_movements rm), 0) as reserve),
  o as (select coalesce(sum(v.pending), 0) as pending from public.v_obligations v
        where v.month = public.month_start(p_month))
  select jsonb_build_object(
    'cash', b.cash,
    'bank', b.bank,
    'total', b.cash + b.bank,
    'savings', e.savings,
    'reserve', e.reserve,
    'available', b.cash + b.bank - e.savings - e.reserve,
    'pending', o.pending,
    'free', b.cash + b.bank - e.savings - e.reserve - o.pending
  )
  from b, e, o
$$;

create or replace function public.adjust_pocket(p jsonb) returns numeric
language plpgsql set search_path = '' as $$
declare
  uid uuid := auth.uid();
  mid uuid := (p->>'id')::uuid;
  target text := p->>'pocket';
  diff numeric;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if mid is null then raise exception 'move id required'; end if;
  if target is null or target not in ('cash', 'bank') then raise exception 'invalid pocket'; end if;
  if exists (select 1 from public.pocket_moves v where v.id = mid) then return 0; end if;

  diff := round((p->>'balance')::numeric - public.pocket_balance(target), 2);
  if diff = 0 then return 0; end if;

  insert into public.pocket_moves (id, user_id, moved_on, from_pocket, to_pocket, amount, note)
  values (mid, uid, coalesce((p->>'moved_on')::date, current_date),
          case when diff < 0 then target end, case when diff > 0 then target end,
          abs(diff), nullif(btrim(p->>'note'), ''));
  return diff;
end $$;

create or replace function public.month_summary(p_month date default current_date) returns jsonb
language sql stable set search_path = '' as $$
  with r as (select public.month_start(p_month) as m,
                    (public.month_start(p_month) + interval '1 month' - interval '1 day')::date as e),
  plan as (select mp.* from public.month_plans mp, r where mp.month = r.m and mp.user_id = auth.uid()),
  inc as (select coalesce(sum(i.amount), 0) as v from public.incomes i, r where i.received_on between r.m and r.e),
  adj as (select coalesce(sum(case when v.from_pocket is null then v.amount when v.to_pocket is null then -v.amount else 0 end), 0) as v
          from public.pocket_moves v, r where v.moved_on between r.m and r.e),
  spent as (select coalesce(sum(s.amount), 0) as v from public.v_spending s, r where s.month = r.m),
  tk as (
    select coalesce(sum(t.total) filter (where coalesce(pm.type, 'cash') <> 'credit'), 0) as cash,
           coalesce(sum(t.total) filter (where pm.type = 'credit'), 0) as credit,
           coalesce(sum(t.total), 0) as purchases,
           count(*) as tickets
    from public.tickets t left join public.payment_methods pm on pm.id = t.payment_method_id, r
    where t.purchased_on between r.m and r.e
  ),
  obl as (
    select coalesce(sum(o.amount), 0) as total, coalesce(sum(o.paid), 0) as paid, coalesce(sum(o.pending), 0) as pending
    from public.v_obligations o, r where o.month = r.m
  ),
  pay as (select coalesce(sum(op.amount), 0) as v from public.obligation_payments op, r
          where op.paid_on between r.m and r.e and op.ticket_id is null),
  sav as (select coalesce(sum(sm.amount), 0) as v from public.savings_movements sm, r where sm.moved_on between r.m and r.e),
  res as (select coalesce(sum(rm.amount), 0) as v from public.reserve_movements rm, r where rm.month = r.m),
  bud as (select coalesce(sum(b.amount), 0) as v from public.budgets b join public.categories c on c.id = b.category_id, r
          where b.month = r.m and c.parent_id is null)
  select jsonb_build_object(
    'month', r.m,
    'total_budget', coalesce((select total_budget from plan), 0),
    'budgeted', bud.v,
    'split_mode', coalesce((select split_mode from plan), 'month'),
    'closed_at', (select closed_at from plan),
    'incomes', inc.v,
    'adjustments', adj.v,
    'spent', spent.v,
    'purchases', tk.purchases,
    'tickets', tk.tickets,
    'cash_spent', tk.cash,
    'credit_spent', tk.credit,
    'obligations_total', obl.total,
    'obligations_paid', obl.paid,
    'obligations_pending', obl.pending,
    'payments_out', pay.v,
    'savings_in', sav.v,
    'reserve_in', res.v,
    'available', adj.v + inc.v - tk.cash - pay.v - sav.v - res.v
  )
  from r, inc, adj, spent, tk, obl, pay, sav, res, bud
$$;

create or replace function public.budget_overview(p_month date default current_date) returns jsonb
language sql stable set search_path = '' as $$
  with r as (
    select public.month_start(p_month) as m,
           (public.month_start(p_month) - interval '1 month')::date as prev,
           (public.month_start(p_month) - interval '3 month')::date as since
  ),
  s as (
    select v.category_id, v.top_category_id, v.month, v.amount, extract(day from v.spent_on) <= 15 as first_half
    from public.v_spending v, r
    where v.month between r.since and r.m
  ),
  active as (
    select greatest(count(distinct s.month), 1) as months from s, r where s.month < r.m
  ),
  per as (
    select c.id as category_id,
           coalesce(sum(s.amount) filter (where s.month = r.m), 0) as spent,
           coalesce(sum(s.amount) filter (where s.month = r.m and s.first_half), 0) as spent_q1,
           coalesce(sum(s.amount) filter (where s.month = r.prev), 0) as previous,
           coalesce(sum(s.amount) filter (where s.month < r.m), 0) as history
    from public.categories c
    cross join r
    left join s on case when c.parent_id is null then s.top_category_id else s.category_id end = c.id
    where c.kind = 'expense'
    group by c.id
  )
  select jsonb_build_object(
    'plan', (
      select jsonb_build_object('total_budget', mp.total_budget, 'split_mode', mp.split_mode, 'closed_at', mp.closed_at)
      from public.month_plans mp, r
      where mp.month = r.m and mp.user_id = (select auth.uid())),
    'uncategorized', (select coalesce(sum(s.amount), 0) from s, r where s.month = r.m and s.category_id is null),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
        'category_id', p.category_id,
        'budget', b.amount,
        'q1_budget', b.q1_amount,
        'spent', p.spent,
        'spent_q1', p.spent_q1,
        'previous', p.previous,
        'average', round(p.history / a.months, 2)))
      from per p
      cross join active a
      left join public.budgets b on b.category_id = p.category_id and b.month = (select m from r)), '[]'::jsonb)
  )
$$;

alter table public.month_plans drop column if exists opening_balance;

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
    'savings_movements', 'reserve_movements', 'shopping_lists', 'shopping_list_items', 'pocket_moves'
  ]
$$;

revoke execute on function public.pocket_of(text) from anon, public;
revoke execute on function public.pocket_balance(text) from anon, public;
revoke execute on function public.money_overview(date) from anon, public;
revoke execute on function public.adjust_pocket(jsonb) from anon, public;
grant execute on function public.pocket_of(text) to authenticated;
grant execute on function public.pocket_balance(text) to authenticated;
grant execute on function public.money_overview(date) to authenticated;
grant execute on function public.adjust_pocket(jsonb) to authenticated;
