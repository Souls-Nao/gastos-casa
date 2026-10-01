create or replace function public.month_obligations(p_month date default current_date) returns jsonb
language sql stable set search_path = '' as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', o.id, 'month', o.month, 'kind', o.kind, 'name', o.name, 'amount', o.amount, 'manual', o.manual,
      'due_date', o.due_date, 'category_id', o.category_id, 'payment_method_id', o.payment_method_id,
      'card_id', o.card_id, 'recurring_id', o.recurring_id, 'msi_plan_id', o.msi_plan_id,
      'paid', o.paid, 'pending', o.pending,
      'payments', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', x.id, 'paid_on', x.paid_on, 'amount', x.amount, 'payment_method_id', x.payment_method_id,
          'ticket_id', x.ticket_id, 'note', x.note) order by x.paid_on, x.created_at)
        from public.obligation_payments x where x.obligation_id = o.id), '[]'::jsonb))
    order by o.due_date nulls last, o.name), '[]'::jsonb)
  from public.v_obligations o
  where o.month = public.month_start(p_month)
$$;

create or replace function public.pay_obligation(p jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  uid uuid := auth.uid();
  pid uuid := (p->>'id')::uuid;
  target public.obligations%rowtype;
  paid_amount numeric := (p->>'amount')::numeric;
  paid_date date := coalesce((p->>'paid_on')::date, current_date);
  method uuid := (p->>'payment_method_id')::uuid;
  tid uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if pid is null then raise exception 'payment id required'; end if;
  if exists (select 1 from public.obligation_payments x where x.id = pid) then return pid; end if;

  select * into target from public.obligations o where o.id = (p->>'obligation_id')::uuid;
  if not found then raise exception 'obligation not found'; end if;

  if target.kind in ('recurring', 'custom') and target.category_id is not null then
    tid := gen_random_uuid();
    perform public.save_ticket(jsonb_build_object(
      'id', tid, 'purchased_on', paid_date, 'purchased_at', null, 'store_id', null, 'payment_method_id', method,
      'discount', 0, 'note', 'Pago: ' || target.name, 'msi', null,
      'items', jsonb_build_array(jsonb_build_object(
        'id', gen_random_uuid(), 'name', target.name, 'category_id', target.category_id,
        'quantity', 1, 'unit', 'pza', 'unit_price', paid_amount))));
  end if;

  insert into public.obligation_payments (id, user_id, obligation_id, paid_on, amount, payment_method_id, ticket_id, note)
  values (pid, uid, target.id, paid_date, paid_amount, method, tid, nullif(btrim(p->>'note'), ''));
  return pid;
end $$;

create or replace function public.undo_payment(p_payment uuid) returns void
language plpgsql set search_path = '' as $$
declare
  tid uuid;
begin
  delete from public.obligation_payments x where x.id = p_payment returning x.ticket_id into tid;
  if tid is not null then
    delete from public.tickets t where t.id = tid;
  end if;
end $$;

create or replace function public.save_recurring(p jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  uid uuid := auth.uid();
  rid uuid := (p->>'id')::uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  insert into public.recurring_expenses (id, user_id, name, category_id, amount, frequency, due_day, start_month, payment_method_id, active)
  values (rid, uid, btrim(p->>'name'), (p->>'category_id')::uuid, (p->>'amount')::numeric,
          coalesce(p->>'frequency', 'monthly'), (p->>'due_day')::int, public.month_start((p->>'start_month')::date),
          (p->>'payment_method_id')::uuid, coalesce((p->>'active')::boolean, true))
  on conflict (id) do update set
    name = excluded.name,
    category_id = excluded.category_id,
    amount = excluded.amount,
    frequency = excluded.frequency,
    due_day = excluded.due_day,
    start_month = excluded.start_month,
    payment_method_id = excluded.payment_method_id,
    active = excluded.active;

  delete from public.obligations o
  where o.recurring_id = rid and not o.manual and o.month >= public.month_start(current_date)
    and not exists (select 1 from public.obligation_payments x where x.obligation_id = o.id);
  return rid;
end $$;

create or replace function public.delete_recurring(p_id uuid) returns void
language plpgsql set search_path = '' as $$
begin
  update public.obligations o
  set recurring_id = null, kind = 'custom', manual = true
  where o.recurring_id = p_id
    and exists (select 1 from public.obligation_payments x where x.obligation_id = o.id);
  delete from public.recurring_expenses r where r.id = p_id;
end $$;

create or replace function public.save_msi_plan(p jsonb) returns uuid
language plpgsql set search_path = '' as $$
declare
  uid uuid := auth.uid();
  pid uuid := (p->>'id')::uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  insert into public.msi_plans as mp (id, user_id, ticket_id, description, category_id, payment_method_id, total_amount, months, first_month)
  values (pid, uid, null, btrim(p->>'description'), (p->>'category_id')::uuid, (p->>'payment_method_id')::uuid,
          (p->>'total_amount')::numeric, (p->>'months')::int, public.month_start((p->>'first_month')::date))
  on conflict (id) do update set
    description = excluded.description,
    category_id = excluded.category_id,
    payment_method_id = excluded.payment_method_id,
    total_amount = excluded.total_amount,
    months = excluded.months,
    first_month = excluded.first_month
  where mp.ticket_id is null;

  delete from public.obligations o
  where o.msi_plan_id = pid
    and not exists (select 1 from public.obligation_payments x where x.obligation_id = o.id);
  return pid;
end $$;

revoke execute on function public.month_obligations(date) from anon, public;
revoke execute on function public.pay_obligation(jsonb) from anon, public;
revoke execute on function public.undo_payment(uuid) from anon, public;
revoke execute on function public.save_recurring(jsonb) from anon, public;
revoke execute on function public.delete_recurring(uuid) from anon, public;
revoke execute on function public.save_msi_plan(jsonb) from anon, public;
grant execute on function public.month_obligations(date) to authenticated;
grant execute on function public.pay_obligation(jsonb) to authenticated;
grant execute on function public.undo_payment(uuid) to authenticated;
grant execute on function public.save_recurring(jsonb) to authenticated;
grant execute on function public.delete_recurring(uuid) to authenticated;
grant execute on function public.save_msi_plan(jsonb) to authenticated;
