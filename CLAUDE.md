# Gestor de Gastos de Casa — instrucciones para Claude Code

Este archivo es la fuente de verdad del proyecto. Léelo completo al iniciar cada sesión y actualiza la sección **Estado** al terminar cada bloque.

## Cómo trabajar con el usuario (Johan)

- Comunicación siempre en **español**, tono directo y breve. La interfaz de la app también va en español (México), moneda **MXN**, formato `$1,234.50`, fechas `dd/mm/aaaa`, semana inicia en lunes.
- **Tú construyes todo.** El usuario no va a programar ni revisar código; solo prueba la app y da retroalimentación.
- **No comentes el código. No expliques el código.** No generes documentación extra en Markdown (este CLAUDE.md es el único documento y aquí se lleva el estado).
- **Ritmo: un bloque por mensaje.** Cada vez que el usuario pida avanzar ("siguiente", "continúa", etc.), haz **solo el siguiente bloque pendiente**, completo y probado. Al terminar:
  1. Verifica que funciona (abre la app con un servidor local y pruébala, idealmente con Playwright en tamaño escritorio y móvil).
  2. Marca el bloque como hecho en **Estado** y anota lo que el siguiente bloque necesita saber (nombres de módulos/funciones públicas nuevas).
  3. Haz commit y push.
  4. Responde con un resumen corto: qué quedó listo, cómo probarlo (2–4 pasos), y si necesitas algo de él.
- Si un bloque necesita una acción que solo el usuario puede hacer (crear una cuenta, iniciar sesión en un servicio, copiar una llave), díselo con pasos numerados y concretos, y espera.
- Modularidad estricta: mantén el orden de creación y ejecución definido abajo; sin código repetido, sin código muerto, sin archivos huérfanos. Si algo se vuelve compartido, muévelo a `core/` o `ui/` y actualiza a quien lo use.
- El usuario usa **Windows** (carpeta del proyecto: `C:\Users\Hissutto\Documents\Gastos`). Da comandos para PowerShell cuando le pidas ejecutar algo.

## Qué es la app

Una app web para administrar el dinero de la casa: registrar en qué se gasta, con qué presupuesto, qué pagos hay pendientes y cuánto se ahorra, para poder comparar mes contra mes y empezar a ahorrar.

- **Un solo usuario/cuenta** para toda la casa (todo el dinero sale del mismo lugar). Varias personas pueden usar la misma cuenta.
- **Computadora:** programa principal con todo el detalle (dashboard, análisis, presupuestos, configuración).
- **Celular:** misma app, instalable (PWA), con una interfaz simple y rápida para capturar compras en la tienda, usar la lista de compras y ver el resumen. Debe funcionar **sin internet** y sincronizar al volver la conexión.
- Los datos viven en la nube (Supabase) y se ven igual en ambos dispositivos.

## Memoria de la conversación (decisiones del usuario)

1. **Datos:** se eligió base de datos gratuita con login, siempre que sea rentable, segura, fácil y cómoda. Se verificó: Supabase cumple (detalles en Arquitectura).
2. **Usuarios:** una sola cuenta para la casa.
3. **Tickets:** la unidad de captura es el **ticket** (compra completa: fecha, tienda, método de pago) con cada **artículo**, su cantidad, unidad y precio. Una compra de un solo artículo es un ticket de un artículo. Cada artículo tiene su propia categoría, así un ticket del súper puede mezclar despensa, limpieza, etc.
4. **Unidad y tienda:** sí. Sirve para ver cómo cambia el precio de un producto con el tiempo y en qué tienda sale más barato.
5. **Método de pago:** sí, incluyendo tarjeta de crédito (día de corte y de pago) y **meses sin intereses (MSI)**.
6. **Categorías:** con **subcategorías**. Sin "Renta". El usuario puede **crear** categorías y subcategorías, y **ocultar/mostrar** las que no use (ocultas no se borran, se pueden volver a mostrar). Ver cómo sube o baja cada categoría y subcategoría por mes. Gráfica/lista de **productos más comprados**.
7. **Alcance:** gastos de la casa **más gastos de escuela** (categoría Escuela).
8. **Ingresos:** sí, se registran.
9. **Presupuestos:** por **mes** y por **categoría/subcategoría**, con opción de dividirlos en **quincenas** (se ven separadas, pero suman al mes). Cada mes se reinicia. El primer mes sirve de ejemplo: si no hay presupuesto, el mes siguiente toma como base lo que realmente se gastó; después copia el presupuesto anterior. Debe verse en tiempo real si una categoría va por encima del mes anterior.
10. **Sobrante:** lo que sobra al final del mes va a la **Reserva**, que es distinta de **Ahorros** (dinero que se quiere guardar a propósito).
11. **Visualizador del mes:** cuánto dinero se está usando, cuánto queda y el total del mes. **Pagos necesarios** con barra que se completa al pagarse (ej.: "Este mes hay que pagar $3,000 de la tarjeta"), y el pago afecta al dinero disponible. Lo mismo para cada presupuesto.
12. **Metas de ahorro:** monto y fecha límite; la app calcula automáticamente **cuánto guardar por mes**.
13. **Calendario:** cada día muestra debajo del número el total gastado. Al seleccionar un día se ve qué se compró, cuánto, qué categorías/subcategorías, productos y tickets.
14. **Dashboard** como pantalla principal, con vistas **General / Día / Mes**.
15. Ideas aceptadas: proyección de fin de mes, comparación mes contra mes, top de productos, categoría "Gastos hormiga", gastos fijos recurrentes con aviso de vencimiento (la luz de CFE es bimestral), alertas al 80% y 100% del presupuesto, presupuesto sugerido por promedio (**solo como sugerencia**), regla 50/30/20 (opcional), app instalable en el celular, **historial de productos** para buscar un producto y solo llenar precio y cantidad, botón "repetir compra", **lista de compras** que se puede ir modificando en la tienda y se convierte en ticket, **foto del ticket opcional**, exportar a CSV/Excel.
16. Sin fecha límite; se avanza a buen ritmo, bloque por bloque.

## Arquitectura (decidida)

- **Frontend:** HTML + CSS + JavaScript puro con **módulos ES**, **sin paso de build** (no Node obligatorio). Librerías por CDN fijando versión:
  - `@supabase/supabase-js@2` (ESM desde `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm`)
  - `chart.js@4` para gráficas
  - `lucide` para iconos (los nombres de iconos de las categorías ya son de Lucide)
- **Backend:** **Supabase** plan gratuito: Postgres + Auth (email y contraseña) + Storage (fotos de tickets). Datos verificados en oct-2026: 500 MB de base de datos, 1 GB de archivos, 50,000 usuarios activos al mes, 2 proyectos. **Se pausa tras 1 semana sin uso** (los datos no se pierden; se reactiva desde el panel). No incluye respaldos automáticos, por eso la app tendrá exportación/respaldo propio.
- **Seguridad:** Row Level Security en todas las tablas (cada fila pertenece a `auth.uid()`), vistas con `security_invoker`, `anon` sin acceso, registro de usuarios nuevos **desactivado** tras crear la cuenta de la casa. En el frontend solo va la **Project URL** y la **publishable/anon key** (son públicas por diseño). **Nunca** pongas en el repo la `service_role`/secret key ni la contraseña de la base de datos.
- **Hosting:** **GitHub Pages** (gratis, HTTPS, necesario para PWA y cámara).
- **Offline:** service worker para el shell de la app + cola de pendientes en IndexedDB. Los IDs (UUID) se generan en el cliente (`crypto.randomUUID()`), así que reenviar un ticket es idempotente (`upsert` por id).
- **Responsivo:** una sola app. Punto de corte ~900px. Escritorio: barra lateral con todas las secciones. Móvil: barra inferior (Inicio, Calendario, **+ Ticket** como botón central destacado, Lista, Más).

### Estructura de carpetas

```
index.html
manifest.webmanifest
sw.js
assets/icons/
css/        tokens.css, base.css, layout.css, components.css, views/*.css
js/
  app.js            arranque: sesión → seed_defaults → ensure_month → router
  config.js         SUPABASE_URL, SUPABASE_KEY
  core/             supabase.js, auth.js, router.js, store.js, format.js, dom.js, events.js, offline.js
  data/             un módulo por entidad; ÚNICA capa que habla con Supabase
  ui/               componentes reutilizables (modal, toast, selector de categoría, input de dinero, barras, gráficas, calendario)
  views/            una vista por sección; solo usan data/ y ui/
supabase/
  schema.sql        esquema base (bloque 1, probado)
  migrations/       cambios posteriores: 002_*.sql, 003_*.sql …
```

Reglas de dependencias: `views → data → core/supabase`. Las vistas nunca llaman a Supabase directo. `ui/` no conoce a `data/`.

### Diseño visual

Interfaz agradable, limpia y moderna, con tema claro y oscuro (según el sistema). Tokens de color en `css/tokens.css`. Cada categoría tiene su color (ya definido en la semilla); úsalo de forma consistente en barras, gráficas y chips. Números de dinero con cifras tabulares. Objetivos táctiles de mínimo 44px en móvil. Capturar un ticket en el celular debe tomar pocos toques.

## Base de datos (bloque 1 — hecho y probado)

`supabase/schema.sql` se probó en PostgreSQL 16 con stubs de `auth` y `storage`: carga sin errores, se puede volver a ejecutar sin romper nada, y pasó pruebas de totales, descuentos, MSI, ciclo de tarjeta, copia de presupuestos, metas y aislamiento entre usuarios.

**Tablas:** `categories` (con `parent_id` para subcategorías, `kind` expense/income, `hidden`, `icon`, `color`, `sort_order`), `stores`, `payment_methods` (`type` cash/debit/credit/transfer/voucher, `closing_day`, `due_day`, `credit_limit`), `products`, `tickets`, `ticket_items` (`amount` = cantidad × precio, columna generada), `msi_plans`, `incomes`, `month_plans` (`total_budget`, `opening_balance`, `split_mode` month/biweekly, `closed_at`), `budgets` (`amount`, `q1_amount`; q2 = amount − q1), `recurring_expenses` (monthly/bimonthly/quarterly/semiannual/yearly), `obligations` (kind card/msi/recurring/custom, `manual`), `obligation_payments` (`ticket_id` si el pago generó un gasto), `savings_goals`, `savings_movements` (+ depósito / − retiro), `reserve_movements` (kind month_close/manual), `shopping_lists`, `shopping_list_items`.

**Automático en la base de datos:**
- `tickets.total` se recalcula solo (suma de artículos − descuento). Nunca lo envíes desde el cliente.
- Cada artículo se liga solo a un `product` por nombre, sin importar mayúsculas (se crea si no existe). Lo mismo con los artículos de la lista de compras.

**Vistas:** `v_spending` (gasto neto por artículo con el descuento prorrateado; las compras a MSI se reparten en sus meses; incluye `month`, `category_id`, `top_category_id`), `v_item_history`, `v_product_stats` (veces comprado, total, último/mín/máx/promedio de precio, última tienda), `v_obligations` (`paid`, `pending`), `v_savings_goals` (`saved`, `remaining`, `months_left`, `monthly_required`, `saved_this_month`).

**Funciones RPC:**
- `seed_defaults()`: idempotente; llámala tras el login. Crea 14 categorías de gasto con subcategorías, 6 de ingreso, métodos de pago y tiendas comunes.
- `ensure_month(p_month)`: idempotente; llámala al abrir la app (mes actual) y al navegar a un mes. Crea el plan del mes, copia presupuestos (o los genera del gasto real del mes anterior), genera los pagos del mes (recurrentes, MSI, tarjetas) y actualiza el monto de las tarjetas no manuales.
- `month_summary(p_month)` → JSON con `incomes`, `spent`, `purchases`, `cash_spent`, `credit_spent`, `obligations_total/paid/pending`, `payments_out`, `savings_in`, `reserve_in`, `available`, `free_after_commitments`, `total_budget`, `budgeted`, `split_mode`, `closed_at`.
- `daily_totals(p_month)` → total y número de tickets por día (para el calendario).
- `card_cycle_amount(card, month)`, `reserve_balance()`, `close_month(p_month)` (pasa lo que sobró a la Reserva; solo para meses terminados y una vez por mes).

**Modelo del dinero (respétalo en toda la UI):**
- **Gastado** (presupuestos, categorías, comparaciones) = `v_spending`: todo lo comprado, sin importar el método de pago; lo comprado a MSI cuenta por mensualidad.
- **Calendario y día** = tickets por fecha de compra, con su monto completo.
- **Disponible** = saldo inicial + ingresos − compras en efectivo/débito/transferencia − pagos de tarjeta/MSI − depósitos a ahorro − movimientos a reserva. Las compras con crédito no restan hasta que se paga la tarjeta.
- **Libre después de compromisos** = disponible − pagos pendientes del mes.
- Al pagar un gasto fijo de servicio (luz, internet…), crea un ticket con su categoría y guarda su `ticket_id` en el pago para no contarlo doble.
- Si un cambio de modelo requiere tocar la base de datos, crea una migración nueva en `supabase/migrations/` y aplícala; no edites a mano lo que ya está en producción.

## Plan de bloques

| # | Bloque | Contenido |
|---|--------|-----------|
| 1 | Base de datos | `supabase/schema.sql` ✅ |
| 2 | Puesta en marcha | Crear el proyecto Supabase y aplicar `schema.sql` (por MCP o guiando al usuario), crear la cuenta de la casa, desactivar registros, `js/config.js`, repo en GitHub, GitHub Pages activo con una página de prueba que conecte y haga login. |
| 3 | Núcleo | `index.html`, tokens y tema claro/oscuro, layout responsivo (lateral / barra inferior), router por hash, cliente Supabase, login/logout con sesión persistente, `seed_defaults` + `ensure_month` al arrancar, utilidades de formato (MXN, fechas), modal, toast, estado global y eventos. |
| 4 | Catálogos | Categorías y subcategorías (crear, editar, color, icono, ordenar, ocultar/mostrar), tiendas, métodos de pago (tarjeta: corte, pago, límite), unidades. |
| 5 | Captura de tickets | Formulario rápido optimizado para móvil: fecha/hora, tienda, método, artículos con autocompletado del historial de productos (llena categoría, unidad y último precio), cantidad × precio, subtotal en vivo, descuento, nota, opción MSI (meses, primer mes). Editar, borrar, "repetir compra". |
| 6 | PWA y offline | Manifest, iconos, service worker, cola en IndexedDB, sincronización automática al volver la conexión, indicador de pendientes, instalación en el celular. |
| 7 | Historial | Lista de tickets con filtros (fechas, categoría, subcategoría, tienda, método, texto) y detalle. Historial de productos: buscador, precio en el tiempo, comparación por tienda, más comprados. |
| 8 | Calendario | Mes con el total bajo cada día e intensidad de color; detalle del día con tickets, artículos, categorías/subcategorías y totales. |
| 9 | Ingresos | Registro, categorías de ingreso, listado por mes. |
| 10 | Presupuestos | Plan del mes (total a usar, saldo inicial, mes o quincenas), presupuesto por categoría y subcategoría, barras gastado vs presupuesto vs mes anterior, alertas 80/100%, sugerencia por promedio de 3 meses (solo sugerencia). |
| 11 | Pagos del mes | Gastos fijos recurrentes, tarjetas (monto del ciclo automático y ajustable), MSI activos con meses restantes, pagos personalizados; barras pagado/pendiente; registrar pagos. |
| 12 | Ahorro y reserva | Metas con cuota mensual automática y progreso, depósitos/retiros; reserva con saldo, movimientos y cierre de mes con confirmación. |
| 13 | Dashboard | Vistas General / Día / Mes: disponible, gastado, presupuesto restante, por pagar, ahorrado, proyección de fin de mes, dona por categoría con detalle por subcategoría, comparación mes vs mes (flechas y %), tendencia de 6–12 meses, top productos, gastos hormiga, alertas. Pantalla principal. |
| 14 | Lista de compras | Listas por tienda, agregar desde el historial, marcar y ajustar precio en la tienda, convertir en ticket. |
| 15 | Extras | Foto de ticket opcional (comprimida a WebP, bucket privado `tickets/<uid>/…`), exportar CSV/Excel, respaldo JSON completo e importación, regla 50/30/20 opcional. |
| 16 | Pulido y QA | Pruebas completas en escritorio y móvil, accesibilidad, rendimiento, revisión de seguridad (RLS, llaves en el repo), publicación final. |

## Servicios que Claude Code necesita

Pídeselos al usuario al iniciar el bloque 2, en este orden:

1. **Git y GitHub CLI** en Windows: `winget install Git.Git` y `winget install GitHub.cli`, luego `gh auth login` (GitHub.com → HTTPS → navegador). Su usuario de GitHub es `Souls-Nao`. Repo sugerido: `gastos-casa`. Puede ser público (el repo no contiene secretos; los datos están protegidos por RLS) o privado si su plan de GitHub permite Pages en privados.
2. **Cuenta de Supabase:** entrar a supabase.com con su cuenta de GitHub. Crear el proyecto `gastos-casa`, región **East US (North Virginia)**, y guardar en un lugar seguro la contraseña de la base de datos (no hace falta compartírtela).
3. **Conector de Supabase** en la app de escritorio de Claude para que apliques el esquema y las migraciones tú mismo: el usuario presiona **Connect** en la tarjeta del conector y autoriza su organización en el navegador (ya hecho el 01/10/2026). Si en una sesión nueva no aparecen las herramientas de Supabase, vuelve a mostrar la tarjeta del conector.
   **Plan B sin conector:** el usuario abre SQL Editor en Supabase, pega el SQL y presiona Run.
4. **Cuenta de la casa:** en Supabase → Authentication → Users → Add user (correo y contraseña, auto-confirmar). Luego Authentication → Sign In / Providers → desactivar **Allow new users to sign up**.
5. **Llaves para la app:** Project Settings → API Keys → **Project URL** y **publishable key** (o anon key) → van en `js/config.js`.
6. Opcional para pruebas: Python ya está instalado; sirve la app en local con `python -m http.server 8080`.

## Estado

- [x] Bloque 1 — Base de datos (`supabase/schema.sql`, probado localmente; **aún no aplicado en Supabase**)
- [x] Bloque 2 — Puesta en marcha
  - [x] Repo público `Souls-Nao/gastos-casa` (rama `main`, commits con correo noreply de GitHub) y GitHub Pages activo en `https://souls-nao.github.io/gastos-casa/`
  - [x] Página de prueba (`index.html`, `css/base.css`, `js/app.js`, `js/core/supabase.js`): login, `seed_defaults`, `ensure_month`, conteos y `month_summary`
  - [x] Servidor local: `.claude/launch.json` (configuración `gastos`, puerto 8080; `.claude/` no se sube al repo)
  - [x] Proyecto Supabase creado: ref `oyawbeizugnkvvyqemcn` (`https://oyawbeizugnkvvyqemcn.supabase.co`), Postgres 17. Claude se conecta con el **conector Supabase** de la app de escritorio (el CLI `claude` y Node no están instalados)
  - [x] `schema.sql` aplicado por el conector (migraciones `schema_01_tables` … `schema_04_security_storage`) y `supabase/migrations/002_revoke_rls_auto_enable.sql`. Verificado: 18 tablas con RLS, 5 vistas `security_invoker`, `anon` sin acceso, bucket `tickets` privado, y prueba de humo como `authenticated` (seed, `ensure_month`, ticket con descuento, `v_spending`, `month_summary`) revertida
  - [x] Cuenta de la casa creada y confirmada
  - [x] `js/config.js` con Project URL y publishable key; la página muestra el formulario de login en local
  - [x] Login probado por el usuario en Pages el 01/10/2026 (Claude no escribe la contraseña)
  - **Pospuesto por decisión del usuario (01/10/2026), hasta nuevo aviso:** apagar en Authentication → Sign In / Providers **Allow new users to sign up** y **Allow anonymous sign-ins**. No insistas en cada bloque; recuérdalo en el bloque 16 (revisión de seguridad) o si él lo menciona. Se comprueba en `/auth/v1/settings`: `disable_signup` y `external.anonymous_users`
- [ ] Bloque 3 — Núcleo ← **siguiente** (reemplaza la página de prueba: `index.html`, `css/base.css` y `js/app.js` se reescriben; `js/core/supabase.js` exporta `supabase` y `configured`)
- [ ] Bloque 4 — Catálogos
- [ ] Bloque 5 — Captura de tickets
- [ ] Bloque 6 — PWA y offline
- [ ] Bloque 7 — Historial
- [ ] Bloque 8 — Calendario
- [ ] Bloque 9 — Ingresos
- [ ] Bloque 10 — Presupuestos
- [ ] Bloque 11 — Pagos del mes
- [ ] Bloque 12 — Ahorro y reserva
- [ ] Bloque 13 — Dashboard
- [ ] Bloque 14 — Lista de compras
- [ ] Bloque 15 — Extras
- [ ] Bloque 16 — Pulido y QA

### Notas para el siguiente bloque

- Migraciones: guarda el SQL en `supabase/migrations/NNN_nombre.sql` y aplícalo con el conector Supabase (`apply_migration`, proyecto `oyawbeizugnkvvyqemcn`). Toda función nueva en `public` necesita `revoke execute ... from anon, public` y `grant execute ... to authenticated`.
- Para probar SQL como el usuario sin dejar datos: bloque `do $$ … $$` que fija `request.jwt.claims`, hace `set local role authenticated` y termina con `raise exception` para revertir.
- Pendiente para el bloque 16: fijar `search_path` en las 14 funciones (aviso del advisor de seguridad de Supabase).

- Llama `seed_defaults()` y después `ensure_month(current_date)` justo después del login.
- No envíes `total` al insertar o actualizar tickets.
- Para el autocompletado de productos usa `v_product_stats` (`last_price`, `unit`, `category_id`, `last_store_id`).
