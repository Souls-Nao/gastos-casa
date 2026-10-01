create or replace function public.monthly_trend(p_months int default 12, p_until date default current_date) returns jsonb
language sql stable set search_path = '' as $$
  with months as (
    select (public.month_start(p_until) - make_interval(months => g.n))::date as m
    from generate_series(0, greatest(p_months, 1) - 1) as g(n)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'month', months.m,
    'spent', coalesce((select sum(s.amount) from public.v_spending s where s.month = months.m), 0),
    'incomes', coalesce((select sum(i.amount) from public.incomes i
                         where i.received_on >= months.m and i.received_on < (months.m + interval '1 month')), 0)
  ) order by months.m), '[]'::jsonb)
  from months
$$;

revoke execute on function public.monthly_trend(int, date) from anon, public;
grant execute on function public.monthly_trend(int, date) to authenticated;
