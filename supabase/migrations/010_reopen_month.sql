create or replace function public.reopen_month(p_month date) returns void
language plpgsql set search_path = '' as $$
declare
  uid uuid := auth.uid();
  m date := public.month_start(p_month);
begin
  if uid is null then raise exception 'not authenticated'; end if;
  delete from public.reserve_movements r where r.user_id = uid and r.month = m and r.kind = 'month_close';
  update public.month_plans mp set closed_at = null where mp.user_id = uid and mp.month = m;
end $$;

revoke execute on function public.reopen_month(date) from anon, public;
grant execute on function public.reopen_month(date) to authenticated;
