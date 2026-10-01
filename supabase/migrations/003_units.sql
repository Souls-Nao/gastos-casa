create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  hidden boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists units_name_uq on public.units (user_id, lower(name));

alter table public.units enable row level security;
drop policy if exists own_rows on public.units;
create policy own_rows on public.units for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.units from anon;
grant select, insert, update, delete on public.units to authenticated;

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
    insert into public.units (user_id, name, sort_order) values
      (uid, 'pza', 1), (uid, 'kg', 2), (uid, 'g', 3), (uid, 'L', 4), (uid, 'ml', 5), (uid, 'paq', 6),
      (uid, 'caja', 7), (uid, 'lata', 8), (uid, 'botella', 9), (uid, 'bolsa', 10), (uid, 'docena', 11), (uid, 'm', 12)
    on conflict do nothing;
  end if;
end $$;

revoke execute on function public.seed_defaults() from anon, public;
grant execute on function public.seed_defaults() to authenticated;
