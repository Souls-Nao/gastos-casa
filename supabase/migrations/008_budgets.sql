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
      select jsonb_build_object('total_budget', mp.total_budget, 'opening_balance', mp.opening_balance,
                                'split_mode', mp.split_mode, 'closed_at', mp.closed_at)
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

create or replace function public.set_budget(p_month date, p_category uuid, p_amount numeric, p_q1 numeric default null) returns numeric
language plpgsql set search_path = '' as $$
declare
  uid uuid := auth.uid();
  m date := public.month_start(p_month);
  parent uuid;
  target uuid;
  children numeric;
  assigned numeric;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select c.parent_id into parent from public.categories c where c.id = p_category;

  if coalesce(p_amount, 0) <= 0 then
    delete from public.budgets b
    where b.user_id = uid and b.month = m
      and (b.category_id = p_category
        or b.category_id in (select c.id from public.categories c where c.parent_id = p_category));
    return null;
  end if;

  insert into public.budgets (user_id, month, category_id, amount, q1_amount)
  values (uid, m, p_category, p_amount, case when p_q1 is null then null else least(greatest(p_q1, 0), p_amount) end)
  on conflict (user_id, month, category_id) do update set amount = excluded.amount, q1_amount = excluded.q1_amount;

  target := coalesce(parent, p_category);
  select coalesce(sum(b.amount), 0) into children
  from public.budgets b join public.categories c on c.id = b.category_id
  where b.user_id = uid and b.month = m and c.parent_id = target;
  select b.amount into assigned from public.budgets b where b.user_id = uid and b.month = m and b.category_id = target;

  if children > coalesce(assigned, 0) then
    insert into public.budgets (user_id, month, category_id, amount)
    values (uid, m, target, children)
    on conflict (user_id, month, category_id) do update set amount = excluded.amount;
    return children;
  end if;
  return null;
end $$;

revoke execute on function public.budget_overview(date) from anon, public;
revoke execute on function public.set_budget(date, uuid, numeric, numeric) from anon, public;
grant execute on function public.budget_overview(date) to authenticated;
grant execute on function public.set_budget(date, uuid, numeric, numeric) to authenticated;
