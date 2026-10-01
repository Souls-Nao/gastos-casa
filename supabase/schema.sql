create extension if not exists pgcrypto;

create or replace function public.month_start(d date) returns date
language sql immutable as $$ select d - (extract(day from d)::int - 1) $$;

create or replace function public.day_in_month(m date, d int) returns date
language sql immutable as $$
  select public.month_start(m) + (least(greatest(coalesce(d, 1), 1),
    extract(day from (public.month_start(m) + interval '1 month' - interval '1 day'))::int) - 1)
$$;

create or replace function public.months_between(a date, b date) returns int
language sql immutable as $$
  select ((extract(year from b) - extract(year from a)) * 12 + (extract(month from b) - extract(month from a)))::int
$$;

create or replace function public.freq_months(f text) returns int
language sql immutable as $$
  select case f when 'monthly' then 1 when 'bimonthly' then 2 when 'quarterly' then 3
                when 'semiannual' then 6 when 'yearly' then 12 else 1 end
$$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  parent_id uuid references public.categories(id) on delete cascade,
  kind text not null default 'expense' check (kind in ('expense','income')),
  name text not null check (length(btrim(name)) > 0),
  icon text,
  color text,
  hidden boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists categories_name_uq
  on public.categories (user_id, coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));
create index if not exists categories_parent_idx on public.categories (parent_id);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists stores_name_uq on public.stores (user_id, lower(name));

create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  type text not null check (type in ('cash','debit','credit','transfer','voucher')),
  closing_day int check (closing_day between 1 and 31),
  due_day int check (due_day between 1 and 31),
  credit_limit numeric(12,2),
  color text,
  hidden boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists payment_methods_name_uq on public.payment_methods (user_id, lower(name));

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  category_id uuid references public.categories(id) on delete set null,
  unit text not null default 'pza',
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists products_name_uq on public.products (user_id, lower(name));

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  purchased_on date not null default current_date,
  purchased_at time,
  store_id uuid references public.stores(id) on delete set null,
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  title text,
  discount numeric(12,2) not null default 0 check (discount >= 0),
  total numeric(12,2) not null default 0,
  note text,
  photo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists tickets_user_date_idx on public.tickets (user_id, purchased_on);
create index if not exists tickets_pm_idx on public.tickets (payment_method_id, purchased_on);

create table if not exists public.ticket_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null check (length(btrim(name)) > 0),
  category_id uuid references public.categories(id) on delete set null,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit text not null default 'pza',
  unit_price numeric(12,2) not null check (unit_price >= 0),
  amount numeric(12,2) generated always as (round(quantity * unit_price, 2)) stored,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists ticket_items_ticket_idx on public.ticket_items (ticket_id);
create index if not exists ticket_items_product_idx on public.ticket_items (product_id);
create index if not exists ticket_items_category_idx on public.ticket_items (category_id);

create table if not exists public.msi_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ticket_id uuid unique references public.tickets(id) on delete cascade,
  description text not null,
  category_id uuid references public.categories(id) on delete set null,
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  total_amount numeric(12,2) not null check (total_amount > 0),
  months int not null check (months between 2 and 60),
  first_month date not null check (extract(day from first_month) = 1),
  created_at timestamptz not null default now()
);

create table if not exists public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  received_on date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  category_id uuid references public.categories(id) on delete set null,
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  description text,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists incomes_user_date_idx on public.incomes (user_id, received_on);

create table if not exists public.month_plans (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  total_budget numeric(12,2) not null default 0,
  opening_balance numeric(12,2) not null default 0,
  split_mode text not null default 'month' check (split_mode in ('month','biweekly')),
  note text,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, month)
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  category_id uuid not null references public.categories(id) on delete cascade,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  q1_amount numeric(12,2) check (q1_amount >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, month, category_id)
);

create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  amount numeric(12,2) not null check (amount >= 0),
  frequency text not null default 'monthly' check (frequency in ('monthly','bimonthly','quarterly','semiannual','yearly')),
  due_day int check (due_day between 1 and 31),
  start_month date not null check (extract(day from start_month) = 1),
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.obligations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  kind text not null check (kind in ('card','msi','recurring','custom')),
  name text not null,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  manual boolean not null default false,
  due_date date,
  category_id uuid references public.categories(id) on delete set null,
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  card_id uuid references public.payment_methods(id) on delete cascade,
  recurring_id uuid references public.recurring_expenses(id) on delete cascade,
  msi_plan_id uuid references public.msi_plans(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index if not exists obligations_card_uq on public.obligations (user_id, month, card_id);
create unique index if not exists obligations_recurring_uq on public.obligations (user_id, month, recurring_id);
create unique index if not exists obligations_msi_uq on public.obligations (user_id, month, msi_plan_id);
create index if not exists obligations_month_idx on public.obligations (user_id, month);

create table if not exists public.obligation_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  obligation_id uuid not null references public.obligations(id) on delete cascade,
  paid_on date not null default current_date,
  amount numeric(12,2) not null check (amount > 0),
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  ticket_id uuid references public.tickets(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists obligation_payments_obl_idx on public.obligation_payments (obligation_id);

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(12,2) not null check (target_amount > 0),
  start_month date not null default public.month_start(current_date) check (extract(day from start_month) = 1),
  target_month date not null check (extract(day from target_month) = 1),
  icon text,
  color text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  check (target_month >= start_month)
);

create table if not exists public.savings_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id uuid not null references public.savings_goals(id) on delete cascade,
  moved_on date not null default current_date,
  amount numeric(12,2) not null check (amount <> 0),
  note text,
  created_at timestamptz not null default now()
);
create index if not exists savings_movements_goal_idx on public.savings_movements (goal_id);

create table if not exists public.reserve_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  moved_on date not null default current_date,
  month date not null check (extract(day from month) = 1),
  amount numeric(12,2) not null check (amount <> 0),
  kind text not null default 'manual' check (kind in ('month_close','manual')),
  note text,
  created_at timestamptz not null default now()
);
create unique index if not exists reserve_month_close_uq on public.reserve_movements (user_id, month) where kind = 'month_close';

create table if not exists public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  store_id uuid references public.stores(id) on delete set null,
  status text not null default 'open' check (status in ('open','done','archived')),
  ticket_id uuid references public.tickets(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  list_id uuid not null references public.shopping_lists(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit text not null default 'pza',
  unit_price numeric(12,2),
  checked boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists shopping_list_items_list_idx on public.shopping_list_items (list_id);

create or replace function public.tg_tickets_total() returns trigger
language plpgsql as $$
begin
  new.total := greatest(coalesce((select sum(amount) from public.ticket_items where ticket_id = new.id), 0) - coalesce(new.discount, 0), 0);
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists tickets_total on public.tickets;
create trigger tickets_total before insert or update on public.tickets
for each row execute function public.tg_tickets_total();

create or replace function public.tg_items_recalc() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    update public.tickets set updated_at = now() where id = old.ticket_id;
    return null;
  end if;
  update public.tickets set updated_at = now() where id = new.ticket_id;
  if tg_op = 'UPDATE' and old.ticket_id <> new.ticket_id then
    update public.tickets set updated_at = now() where id = old.ticket_id;
  end if;
  return null;
end $$;

drop trigger if exists ticket_items_recalc on public.ticket_items;
create trigger ticket_items_recalc after insert or update or delete on public.ticket_items
for each row execute function public.tg_items_recalc();

create or replace function public.tg_item_link_product() returns trigger
language plpgsql as $$
begin
  new.name := btrim(new.name);
  if tg_op = 'UPDATE' and new.name is distinct from old.name and new.product_id is not distinct from old.product_id then
    new.product_id := null;
  end if;
  if new.product_id is null then
    insert into public.products (user_id, name, category_id, unit)
    values (new.user_id, new.name, new.category_id, coalesce(new.unit, 'pza'))
    on conflict (user_id, lower(name)) do update set name = public.products.name
    returning id into new.product_id;
  end if;
  return new;
end $$;

drop trigger if exists ticket_items_link_product on public.ticket_items;
create trigger ticket_items_link_product before insert or update of name, product_id on public.ticket_items
for each row execute function public.tg_item_link_product();

drop trigger if exists shopping_list_items_link_product on public.shopping_list_items;
create trigger shopping_list_items_link_product before insert or update of name, product_id on public.shopping_list_items
for each row execute function public.tg_item_link_product();

create or replace view public.v_spending with (security_invoker = true) as
with items as (
  select i.user_id, i.id as item_id, i.ticket_id, t.purchased_on, t.store_id, t.payment_method_id,
         i.product_id, i.category_id, i.quantity,
         round(i.amount * case when t.total + t.discount > 0 then t.total / (t.total + t.discount) else 1 end, 2) as net_amount
  from public.ticket_items i
  join public.tickets t on t.id = i.ticket_id
)
select it.user_id, it.item_id, it.ticket_id, it.purchased_on as spent_on,
       public.month_start(it.purchased_on) as month,
       it.category_id, coalesce(c.parent_id, c.id) as top_category_id,
       it.product_id, it.store_id, it.payment_method_id, it.quantity,
       it.net_amount as amount, false as is_msi
from items it
left join public.categories c on c.id = it.category_id
where not exists (select 1 from public.msi_plans p where p.ticket_id = it.ticket_id)
union all
select it.user_id, it.item_id, it.ticket_id,
       (p.first_month + make_interval(months => g.n))::date,
       (p.first_month + make_interval(months => g.n))::date,
       it.category_id, coalesce(c.parent_id, c.id),
       it.product_id, it.store_id, it.payment_method_id,
       case when g.n = 0 then it.quantity else 0 end,
       round(it.net_amount / p.months, 2), true
from items it
join public.msi_plans p on p.ticket_id = it.ticket_id
cross join lateral generate_series(0, p.months - 1) as g(n)
left join public.categories c on c.id = it.category_id
union all
select p.user_id, null::uuid, null::uuid,
       (p.first_month + make_interval(months => g.n))::date,
       (p.first_month + make_interval(months => g.n))::date,
       p.category_id, coalesce(c.parent_id, c.id),
       null::uuid, null::uuid, p.payment_method_id, 0::numeric,
       round(p.total_amount / p.months, 2), true
from public.msi_plans p
cross join lateral generate_series(0, p.months - 1) as g(n)
left join public.categories c on c.id = p.category_id
where p.ticket_id is null;

create or replace view public.v_item_history with (security_invoker = true) as
select i.id as item_id, i.user_id, i.ticket_id, i.product_id, i.name, i.category_id,
       coalesce(c.parent_id, c.id) as top_category_id,
       i.quantity, i.unit, i.unit_price, i.amount,
       t.purchased_on, t.purchased_at, t.store_id, t.payment_method_id
from public.ticket_items i
join public.tickets t on t.id = i.ticket_id
left join public.categories c on c.id = i.category_id;

create or replace view public.v_product_stats with (security_invoker = true) as
select p.id, p.user_id, p.name, p.category_id, p.unit, p.hidden,
       count(h.item_id) as times_bought,
       coalesce(sum(h.quantity), 0) as total_quantity,
       coalesce(sum(h.amount), 0) as total_spent,
       max(h.purchased_on) as last_bought_on,
       round(avg(h.unit_price), 2) as avg_price,
       min(h.unit_price) as min_price,
       max(h.unit_price) as max_price,
       (select h2.unit_price from public.v_item_history h2 where h2.product_id = p.id
         order by h2.purchased_on desc, h2.purchased_at desc nulls last limit 1) as last_price,
       (select h2.store_id from public.v_item_history h2 where h2.product_id = p.id
         order by h2.purchased_on desc, h2.purchased_at desc nulls last limit 1) as last_store_id
from public.products p
left join public.v_item_history h on h.product_id = p.id
group by p.id;

create or replace view public.v_obligations with (security_invoker = true) as
select o.*,
       coalesce((select sum(op.amount) from public.obligation_payments op where op.obligation_id = o.id), 0) as paid,
       greatest(o.amount - coalesce((select sum(op.amount) from public.obligation_payments op where op.obligation_id = o.id), 0), 0) as pending
from public.obligations o;

create or replace view public.v_savings_goals with (security_invoker = true) as
select g.*,
       coalesce(s.saved, 0) as saved,
       greatest(g.target_amount - coalesce(s.saved, 0), 0) as remaining,
       greatest(public.months_between(greatest(public.month_start(current_date), g.start_month), g.target_month) + 1, 1) as months_left,
       round(greatest(g.target_amount - coalesce(s.saved, 0), 0)
             / greatest(public.months_between(greatest(public.month_start(current_date), g.start_month), g.target_month) + 1, 1), 2) as monthly_required,
       round(g.target_amount / (public.months_between(g.start_month, g.target_month) + 1), 2) as monthly_planned,
       coalesce(s.this_month, 0) as saved_this_month
from public.savings_goals g
left join (
  select goal_id, sum(amount) as saved,
         sum(amount) filter (where public.month_start(moved_on) = public.month_start(current_date)) as this_month
  from public.savings_movements group by goal_id
) s on s.goal_id = g.id;

create or replace function public.card_cycle_amount(p_card uuid, p_month date) returns numeric
language sql stable as $$
  with pm as (select closing_day, due_day from public.payment_methods where id = p_card),
  cyc as (
    select case when coalesce(pm.due_day, 0) > pm.closing_day
                then public.day_in_month((public.month_start(p_month) - interval '1 month')::date, pm.closing_day) + 1
                else public.day_in_month((public.month_start(p_month) - interval '2 month')::date, pm.closing_day) + 1 end as s,
           case when coalesce(pm.due_day, 0) > pm.closing_day
                then public.day_in_month(p_month, pm.closing_day)
                else public.day_in_month((public.month_start(p_month) - interval '1 month')::date, pm.closing_day) end as e
    from pm
  )
  select coalesce(sum(t.total), 0)
  from public.tickets t, cyc
  where t.payment_method_id = p_card
    and t.purchased_on between cyc.s and cyc.e
    and not exists (select 1 from public.msi_plans p where p.ticket_id = t.id)
$$;

create or replace function public.ensure_month(p_month date default current_date) returns void
language plpgsql as $$
declare
  uid uuid := auth.uid();
  m date := public.month_start(p_month);
  prev date := (public.month_start(p_month) - interval '1 month')::date;
  inserted int;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  insert into public.month_plans (user_id, month, total_budget, split_mode)
  select uid, m, coalesce(pp.total_budget, 0), coalesce(pp.split_mode, 'month')
  from (select 1) x
  left join public.month_plans pp on pp.user_id = uid and pp.month = prev
  on conflict (user_id, month) do nothing;
  get diagnostics inserted = row_count;

  if inserted > 0 and not exists (select 1 from public.budgets where user_id = uid and month = m) then
    if exists (select 1 from public.budgets where user_id = uid and month = prev) then
      insert into public.budgets (user_id, month, category_id, amount, q1_amount)
      select uid, m, b.category_id, b.amount, b.q1_amount
      from public.budgets b join public.categories c on c.id = b.category_id
      where b.user_id = uid and b.month = prev and not c.hidden
      on conflict (user_id, month, category_id) do nothing;
    else
      insert into public.budgets (user_id, month, category_id, amount)
      select uid, m, s.top_category_id, ceil(sum(s.amount))
      from public.v_spending s
      where s.user_id = uid and s.month = prev and s.top_category_id is not null
      group by s.top_category_id having sum(s.amount) > 0
      on conflict (user_id, month, category_id) do nothing;

      insert into public.budgets (user_id, month, category_id, amount)
      select uid, m, s.category_id, ceil(sum(s.amount))
      from public.v_spending s
      where s.user_id = uid and s.month = prev and s.category_id is not null and s.category_id <> s.top_category_id
      group by s.category_id having sum(s.amount) > 0
      on conflict (user_id, month, category_id) do nothing;
    end if;

    update public.month_plans mp
    set total_budget = coalesce((select sum(b.amount) from public.budgets b join public.categories c on c.id = b.category_id
                                 where b.user_id = uid and b.month = m and c.parent_id is null), 0)
    where mp.user_id = uid and mp.month = m and mp.total_budget = 0;
  end if;

  insert into public.obligations (user_id, month, kind, name, amount, due_date, category_id, payment_method_id, recurring_id)
  select uid, m, 'recurring', r.name, r.amount, public.day_in_month(m, r.due_day), r.category_id, r.payment_method_id, r.id
  from public.recurring_expenses r
  where r.user_id = uid and r.active and m >= r.start_month
    and public.months_between(r.start_month, m) % public.freq_months(r.frequency) = 0
  on conflict (user_id, month, recurring_id) do nothing;

  insert into public.obligations (user_id, month, kind, name, amount, due_date, category_id, payment_method_id, msi_plan_id)
  select uid, m, 'msi',
         p.description || ' (' || (public.months_between(p.first_month, m) + 1) || '/' || p.months || ')',
         round(p.total_amount / p.months, 2),
         public.day_in_month(m, pm.due_day), p.category_id, p.payment_method_id, p.id
  from public.msi_plans p
  left join public.payment_methods pm on pm.id = p.payment_method_id
  where p.user_id = uid and m >= p.first_month and public.months_between(p.first_month, m) < p.months
  on conflict (user_id, month, msi_plan_id) do nothing;

  insert into public.obligations (user_id, month, kind, name, amount, due_date, payment_method_id, card_id)
  select uid, m, 'card', pm.name, 0, public.day_in_month(m, coalesce(pm.due_day, pm.closing_day)), pm.id, pm.id
  from public.payment_methods pm
  where pm.user_id = uid and pm.type = 'credit' and pm.closing_day is not null and not pm.hidden
  on conflict (user_id, month, card_id) do nothing;

  update public.obligations o
  set amount = public.card_cycle_amount(o.card_id, m)
  where o.user_id = uid and o.month = m and o.kind = 'card' and not o.manual;
end $$;

create or replace function public.month_summary(p_month date default current_date) returns jsonb
language sql stable as $$
  with r as (select public.month_start(p_month) as m,
                    (public.month_start(p_month) + interval '1 month' - interval '1 day')::date as e),
  plan as (select mp.* from public.month_plans mp, r where mp.month = r.m and mp.user_id = auth.uid()),
  inc as (select coalesce(sum(i.amount), 0) as v from public.incomes i, r where i.received_on between r.m and r.e),
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
    'opening_balance', coalesce((select opening_balance from plan), 0),
    'split_mode', coalesce((select split_mode from plan), 'month'),
    'closed_at', (select closed_at from plan),
    'incomes', inc.v,
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
    'available', coalesce((select opening_balance from plan), 0) + inc.v - tk.cash - pay.v - sav.v - res.v,
    'free_after_commitments', coalesce((select opening_balance from plan), 0) + inc.v - tk.cash - pay.v - sav.v - res.v - obl.pending
  )
  from r, inc, spent, tk, obl, pay, sav, res, bud
$$;

create or replace function public.daily_totals(p_month date default current_date)
returns table (day date, total numeric, tickets bigint)
language sql stable as $$
  select t.purchased_on, sum(t.total), count(*)
  from public.tickets t
  where t.purchased_on between public.month_start(p_month)
        and (public.month_start(p_month) + interval '1 month' - interval '1 day')::date
  group by t.purchased_on
  order by t.purchased_on
$$;

create or replace function public.reserve_balance() returns numeric
language sql stable as $$ select coalesce(sum(amount), 0) from public.reserve_movements $$;

create or replace function public.close_month(p_month date) returns numeric
language plpgsql as $$
declare
  uid uuid := auth.uid();
  m date := public.month_start(p_month);
  leftover numeric;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if m >= public.month_start(current_date) then raise exception 'month not finished'; end if;
  perform public.ensure_month(m);
  if exists (select 1 from public.month_plans where user_id = uid and month = m and closed_at is not null) then
    raise exception 'month already closed';
  end if;
  leftover := (public.month_summary(m) ->> 'available')::numeric;
  if leftover <> 0 then
    insert into public.reserve_movements (user_id, moved_on, month, amount, kind, note)
    values (uid, (m + interval '1 month' - interval '1 day')::date, m, leftover, 'month_close', 'Cierre de mes');
  end if;
  update public.month_plans set closed_at = now() where user_id = uid and month = m;
  return leftover;
end $$;

create or replace function public.seed_defaults() returns void
language plpgsql as $$
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
  if exists (select 1 from public.categories where user_id = uid) then return; end if;

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
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'categories','stores','payment_methods','products','tickets','ticket_items','msi_plans','incomes',
    'month_plans','budgets','recurring_expenses','obligations','obligation_payments','savings_goals',
    'savings_movements','reserve_movements','shopping_lists','shopping_list_items'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format('create policy own_rows on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
  end loop;
end $$;

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke execute on all functions in schema public from anon, public;
grant execute on all functions in schema public to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tickets', 'tickets', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists tickets_photos_select on storage.objects;
drop policy if exists tickets_photos_insert on storage.objects;
drop policy if exists tickets_photos_update on storage.objects;
drop policy if exists tickets_photos_delete on storage.objects;
create policy tickets_photos_select on storage.objects for select to authenticated
  using (bucket_id = 'tickets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy tickets_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'tickets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy tickets_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'tickets' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy tickets_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'tickets' and (storage.foldername(name))[1] = (select auth.uid())::text);
