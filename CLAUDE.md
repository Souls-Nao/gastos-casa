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
17. **Eliminar (01/10/2026):** todo lo que el usuario puede crear también se puede **eliminar**, además de ocultar (categorías, subcategorías, tiendas, métodos de pago, unidades, y en los bloques siguientes tickets, ingresos, presupuestos, pagos, metas, listas…). Siempre con confirmación que diga qué se pierde. Única excepción: un método de pago que ya tiene movimientos no se elimina (cambiaría las cuentas de meses pasados); solo se oculta.
18. **Efectivo y tarjeta (02/10/2026):** el dinero se separa en dos bolsillos, **Efectivo** y **Tarjeta** (una sola cuenta de banco; débito y transferencia salen del mismo saldo). Cada bolsillo muestra lo que hay de verdad y no se reinicia al cambiar de mes. Sacar del cajero o depositar es un **movimiento entre bolsillos**, no un gasto. El ahorro y la reserva **se quedan donde están** (solo se apartan), así que **Disponible = Efectivo + Tarjeta − Reserva − Ahorro en metas**. Además se muestra **Libre después de pagos** = Disponible − lo que falta por pagar del mes. El sobrante del mes sigue yendo a la Reserva al cerrar el mes (decisión 10).

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

**Tablas:** `categories` (con `parent_id` para subcategorías, `kind` expense/income, `hidden`, `icon`, `color`, `sort_order`), `stores`, `payment_methods` (`type` cash/debit/credit/transfer/voucher, `closing_day`, `due_day`, `credit_limit`), `products`, `tickets`, `ticket_items` (`amount` = cantidad × precio, columna generada), `msi_plans`, `incomes`, `month_plans` (`total_budget`, `split_mode` month/biweekly, `closed_at`; el saldo inicial se quitó en la migración 015), `budgets` (`amount`, `q1_amount`; q2 = amount − q1), `recurring_expenses` (monthly/bimonthly/quarterly/semiannual/yearly), `obligations` (kind card/msi/recurring/custom, `manual`), `obligation_payments` (`ticket_id` si el pago generó un gasto), `savings_goals`, `savings_movements` (+ depósito / − retiro), `reserve_movements` (kind month_close/manual), `shopping_lists`, `shopping_list_items`, `units` (`name`, `hidden`, `sort_order`; migración 003), `pocket_moves` (`from_pocket`, `to_pocket` = `cash` | `bank` | nulo, `amount` > 0; migración 015).

**Automático en la base de datos:**
- `tickets.total` se recalcula solo (suma de artículos − descuento). Nunca lo envíes desde el cliente.
- Cada artículo se liga solo a un `product` por nombre, sin importar mayúsculas (se crea si no existe). Lo mismo con los artículos de la lista de compras.

**Vistas:** `v_spending` (gasto neto por artículo con el descuento prorrateado; las compras a MSI se reparten en sus meses; incluye `month`, `category_id`, `top_category_id`), `v_item_history`, `v_product_stats` (veces comprado, total, último/mín/máx/promedio de precio, última tienda), `v_obligations` (`paid`, `pending`), `v_savings_goals` (`saved`, `remaining`, `months_left`, `monthly_required`, `saved_this_month`).

**Funciones RPC:**
- `seed_defaults()`: idempotente; llámala tras el login. Crea 14 categorías de gasto con subcategorías, 6 de ingreso, métodos de pago y tiendas comunes.
- `ensure_month(p_month)`: idempotente; llámala al abrir la app (mes actual) y al navegar a un mes. Crea el plan del mes, copia presupuestos (o los genera del gasto real del mes anterior), genera los pagos del mes (recurrentes, MSI, tarjetas) y actualiza el monto de las tarjetas no manuales.
- `month_summary(p_month)` → JSON con `incomes`, `spent`, `purchases`, `cash_spent`, `credit_spent`, `obligations_total/paid/pending`, `payments_out`, `savings_in`, `reserve_in`, `adjustments`, `available` (balance del mes: lo que entró menos lo que salió), `total_budget`, `budgeted`, `split_mode`, `closed_at`.
- `daily_totals(p_month)` → total y número de tickets por día (para el calendario).
- `card_cycle_amount(card, month)`, `reserve_balance()`, `close_month(p_month)` (pasa lo que sobró a la Reserva; solo para meses terminados y una vez por mes).

**Modelo del dinero (respétalo en toda la UI):**
- **Gastado** (presupuestos, categorías, comparaciones) = `v_spending`: todo lo comprado, sin importar el método de pago; lo comprado a MSI cuenta por mensualidad.
- **Calendario y día** = tickets por fecha de compra, con su monto completo.
- **Bolsillos** (decisión 18): `pocket_of(tipo)` → efectivo y sin método = `cash`; débito, transferencia y vales = `bank`; crédito = ninguno. Saldo de un bolsillo (de siempre, no por mes) = ingresos recibidos ahí − tickets pagados desde ahí − pagos sin ticket hechos desde ahí ± movimientos (`pocket_moves`). Las compras con crédito no restan hasta que se paga la tarjeta.
- **Disponible** = Efectivo + Tarjeta − Reserva − Ahorro en metas (`money_overview`). Es continuo; equivale a la suma del balance (`month_summary.available`) de todos los meses, y un mes cerrado queda en cero porque su sobrante pasó a la Reserva.
- **Libre después de pagos** = Disponible − pagos pendientes del mes en curso.
- **Balance del mes** (`month_summary.available`) = ajustes de saldo + ingresos − compras que no son a crédito − pagos sin ticket − ahorro − reserva de ese mes. Es lo que `close_month` pasa a la Reserva.
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

- [x] Bloque 1 — Base de datos (`supabase/schema.sql`, aplicado en Supabase en el bloque 2)
- [x] Bloque 2 — Puesta en marcha
  - [x] Repo público `Souls-Nao/gastos-casa` (rama `main`, commits con correo noreply de GitHub) y GitHub Pages activo en `https://souls-nao.github.io/gastos-casa/`
  - [x] Servidor local: `.claude/launch.json` (configuración `gastos`, puerto 8080; `.claude/` no se sube al repo)
  - [x] Proyecto Supabase creado: ref `oyawbeizugnkvvyqemcn` (`https://oyawbeizugnkvvyqemcn.supabase.co`), Postgres 17. Claude se conecta con el **conector Supabase** de la app de escritorio (el CLI `claude` y Node no están instalados)
  - [x] `schema.sql` aplicado por el conector (migraciones `schema_01_tables` … `schema_04_security_storage`) y `supabase/migrations/002_revoke_rls_auto_enable.sql`. Verificado: 18 tablas con RLS, 5 vistas `security_invoker`, `anon` sin acceso, bucket `tickets` privado, y prueba de humo como `authenticated` (seed, `ensure_month`, ticket con descuento, `v_spending`, `month_summary`) revertida
  - [x] Cuenta de la casa creada y confirmada
  - [x] `js/config.js` con Project URL y publishable key; la página muestra el formulario de login en local
  - [x] Login probado por el usuario en Pages el 01/10/2026 (Claude no escribe la contraseña)
  - **Pospuesto por decisión del usuario (01/10/2026), hasta nuevo aviso:** apagar en Authentication → Sign In / Providers **Allow new users to sign up** y **Allow anonymous sign-ins**. No insistas en cada bloque; recuérdalo en el bloque 16 (revisión de seguridad) o si él lo menciona. Se comprueba en `/auth/v1/settings`: `disable_signup` y `external.anonymous_users`
- [x] Bloque 3 — Núcleo. Probado en local en escritorio (1280px) y móvil (375px), tema claro y oscuro: login, menú lateral, barra inferior, router, vistas Inicio / Más / pendientes, modal y toast. Las vistas con sesión se probaron montando el shell a mano y simulando las respuestas RPC; **el flujo real con sesión (entrar, recargar y seguir dentro, cerrar sesión) lo prueba el usuario en Pages**
- [x] Bloque 4 — Catálogos. `#/catalogos?tab=categorias|tiendas|pagos|unidades` (categorías además con `&kind=expense|income`). Todo se puede ocultar/mostrar y eliminar (botón **Eliminar** dentro del formulario de edición; RPC `catalog_usage(p_table, p_id)` de la migración `004_catalog_usage.sql` cuenta los registros afectados). Tabla nueva `units` (migración `003_units.sql`, aplicada; `seed_defaults` ahora también siembra 12 unidades). Probado en local con el arnés de pruebas en escritorio y móvil; la prueba con datos reales la hace el usuario en Pages
- [x] Bloque 5 — Captura de tickets. `#/ticket` (nuevo), `#/ticket/<id>` (editar, con **Repetir compra** y **Eliminar**), `#/ticket?repetir=<id>`. RPC `save_ticket(p jsonb)` (migración `005_save_ticket.sql`, aplicada y probada): guarda ticket, artículos y plan MSI en una sola transacción y es idempotente. Inicio muestra "Últimos tickets del mes". Probado en local con el arnés en escritorio y móvil; la prueba con datos reales la hace el usuario en Pages
- [x] Bloque 6 — PWA y offline. `manifest.webmanifest`, iconos PNG en `assets/icons/`, `sw.js`, caché de lectura y cola de pendientes en IndexedDB, sincronización automática, indicador en la barra superior, botón "Instalar la app". Probado en local: la app abre con el servidor apagado, y con el arnés se probó guardar/editar un ticket sin conexión, enviarlo al volver y el caso de rechazo del servidor. **Falta la prueba real en el celular del usuario** (instalar, modo avión)
- [x] Bloque 7 — Historial. `#/historial` (tickets con filtros en la URL: `desde`, `hasta`, `categoria`, `tienda`, `metodo`, `q`) y `#/historial?tab=productos` (buscador, orden, detalle con precio en el tiempo, comparación por tienda y compras). RPC `search_tickets(p jsonb)` (migración `006_search_tickets.sql`, aplicada y probada; usa `unaccent`). Tocar un ticket en Inicio o Historial abre su detalle (ventana) con **Repetir compra** y **Editar**. Probado en local con el arnés en escritorio y móvil; la prueba con datos reales la hace el usuario en Pages
- [x] Bloque 8 — Calendario. `#/calendario` (`?dia=aaaa-mm-dd` guarda el día elegido): mes con total por día, cuatro niveles de color por rango entre los días con gasto, y detalle del día (por categoría y subcategoría, tickets, artículos). RPC `day_detail(p_day)` (migración `007_day_detail.sql`, aplicada y probada). Probado en local con el arnés en escritorio y móvil; la prueba con datos reales la hace el usuario en Pages
- [x] Bloque 9 — Ingresos. `#/ingresos`: listado del mes, total, desglose por categoría, alta/edición/eliminación en ventana. Sin migración (usa la tabla `incomes`). Requiere conexión para guardar. Probado en local con el arnés y el guardado directo en la base (revertido); la prueba con datos reales la hace el usuario en Pages
- [x] Bloque 10 — Presupuestos. `#/presupuestos`: plan del mes (total a usar, todo el mes o quincenas), presupuesto por categoría y subcategoría, barras gastado / mes anterior / límite, alertas al 80% y 100%, sugerencia por promedio. RPC `budget_overview(p_month)` y `set_budget(p_month, p_category, p_amount, p_q1)` (migración `008_budgets.sql`, aplicada y probada). Requiere conexión para guardar. Probado en local con el arnés en escritorio y móvil; la prueba con datos reales la hace el usuario en Pages
- [x] Bloque 11 — Pagos del mes. `#/pagos` (pagos del mes con barra pagado/pendiente, avisos de vencimiento, registrar y deshacer pagos, pagos únicos, ajuste del monto de la tarjeta), `#/pagos?tab=fijos` (gastos fijos recurrentes) y `#/pagos?tab=msi` (compras a meses activas, y alta manual de las que ya se venían pagando). Migración `009_payments.sql` (aplicada y probada). Requiere conexión para guardar. Probado en local con el arnés en escritorio y móvil; la prueba con datos reales la hace el usuario en Pages
- [x] Bloque 12 — Ahorro y reserva. `#/ahorro` (metas con cuota mensual automática, progreso, guardar/retirar, movimientos, archivar y eliminar) y `#/ahorro?tab=reserva` (saldo, guardar/usar, movimientos, cierre de meses terminados con confirmación y reapertura). Migración `010_reopen_month.sql` (aplicada y probada). Requiere conexión para guardar. Probado en local con el arnés en escritorio y móvil; la prueba con datos reales la hace el usuario en Pages
- [x] Bloque 13 — Dashboard. Inicio con tres vistas: `#/` o `#/?vista=general` (mes en curso: seis indicadores, alertas, tendencia de 6 a 12 meses, productos más comprados), `#/?vista=dia&dia=aaaa-mm-dd` (gasto del día, cuánto se puede gastar por día, detalle) y `#/?vista=mes` (dona por categoría con subcategorías, comparación con el mes anterior, gastos hormiga, últimos tickets). RPC `monthly_trend(p_months, p_until)` (migración `011_monthly_trend.sql`, aplicada y probada). Probado en local con el arnés en escritorio y móvil; la prueba con datos reales la hace el usuario en Pages
- [x] Bloque 14 — Lista de compras. `#/lista` (`?id=` guarda la lista abierta): varias listas, cada una con tienda opcional; agregar escribiendo (con autocompletado) o desde el historial; marcar, ajustar cantidad, unidad, precio y categoría; total estimado y del carrito; **Convertir en ticket** abre `#/ticket?lista=<id>`. Funciona sin conexión (se encola). RPC `save_shopping_list(p jsonb)` (migración `012_save_shopping_list.sql`, aplicada y probada). Se eliminó `views/pending.js` (ya no hay secciones pendientes). Probado en local con el arnés en escritorio y móvil; la prueba real la hace el usuario en Pages
- [x] Bloque 15 — Extras. Foto opcional del ticket (comprimida a WebP o JPEG, máx. 1600 px, bucket privado `tickets/<uid>/<ticket_id>.<ext>`), sección nueva `#/datos` (exportar a Excel `.xlsx` de cuatro hojas o CSV, descargar respaldo JSON y restaurarlo), y regla 50/30/20 opcional en Presupuestos. Migración `013_extras.sql` (aplicada; el ciclo respaldo → borrar → restaurar se probó en la base real dentro de una transacción revertida). Probado en local con el arnés; el `.xlsx` se validó como zip y XML con Python, **no se abrió en Excel real**; la subida real de fotos no se pudo probar sin sesión. La prueba real la hace el usuario en Pages
- [x] Bloque 16 — Pulido y QA (01/10/2026). **Todos los bloques del plan están terminados.**
  - Seguridad: las 19 tablas con RLS y política, `anon` sin permisos sobre tablas ni funciones, vistas `security_invoker`, bucket privado, todas las funciones con `search_path` fijo (migración `014_search_path.sql`), sin llaves secretas en el repo ni en su historial. Prueba de humo completa como usuario tras el cambio (revertida).
  - Accesibilidad: contraste AA en ambos temas (el acento claro pasó a `#197a53` y el rojo a `#b23328`), enlace "Saltar al contenido", etiquetas en campos sin `label`, pestañas de 44 px.
  - Carga: `js/boot.js` muestra "No se pudo cargar la app" con botón Reintentar si a los 12 s sigue "Cargando…"; `preconnect` al CDN y a Supabase.
  - Service worker: si la página sale de la caché (sin red o más de 3 s), el resto de esa carga se sirve de la caché para no mezclar versiones; si la página sale de la red, los archivos van a la red con caída a caché a los 8 s.
  - Pruebas: recorrido automático de las 22 pantallas con el arnés en 375 px y 1280 px (sin errores, textos rotos ni desbordes); la app abre y carga todas las vistas con el servidor local apagado.
  - **Sigue pendiente del usuario** (lo pospuso el 01/10/2026): apagar en Supabase → Authentication → Sign In / Providers **Allow new users to sign up** y **Allow anonymous sign-ins**. Al cierre seguían encendidos.

### Después del plan (mantenimiento)

- [x] **Efectivo y tarjeta** (02/10/2026, decisión 18). Sección nueva `#/dinero` y bloque "Tu dinero" en Inicio → General con cuatro tarjetas: Disponible, En efectivo, En tarjeta y Libre después de pagos. Movimientos: **Retiro de cajero** (tarjeta → efectivo), **Depósito** (efectivo → tarjeta) y **Ajustar saldo** (se escribe el saldo real y se guarda la diferencia). Migración `015_pockets.sql` (aplicada y probada en la base real con transacción revertida). Requiere conexión para guardar. Probado en local con el arnés en 375 px y 1280 px; la prueba con datos reales la hace el usuario en Pages.
  - RPC: `money_overview(p_month)` → `{ cash, bank, total, savings, reserve, available, pending, free }` (`pending` = pagos pendientes de `p_month`; el cliente manda el mes en curso); `adjust_pocket(p)` (`{ id, pocket, balance, moved_on, note }`, idempotente por `id`, devuelve la diferencia); internas `pocket_of(tipo)` y `pocket_balance(bolsillo)`.
  - `pocket_moves`: retiro = `from bank, to cash`; depósito = `from cash, to bank`; ajuste = solo `to_pocket` (sube) o solo `from_pocket` (baja). Un ajuste cuenta en el balance de su mes (sustituye al antiguo "Saldo inicial" del plan, que se eliminó); un retiro o depósito no cambia el disponible.
  - `data/money.js`: `POCKETS`, `MOVE_KINDS`, `getMoneyOverview()`, `listPocketMoves()`, `moveKind(mov)` → `'withdrawal' | 'deposit' | 'adjustment'`, `addTransfer(tipo, valores)`, `adjustPocket(ajuste)`, `deletePocketMove(id)`. `views/money.js` (sección) y `views/money-parts.js` (`moneyTiles(overview)`, `openTransfer(tipo, overview, alTerminar)`, `openAdjust(overview, alTerminar)`; lo comparten la sección y el dashboard).
  - Cambios en lo existente: en Ingresos "Recibido en" es obligatorio (decide el bolsillo; por defecto débito); la vista Mes y la vista Día muestran "Balance del mes" en vez de "Disponible"; alertas nuevas si el efectivo o la tarjeta quedan en negativo; el Excel tiene una quinta hoja "Efectivo y tarjeta"; `backup_tables()` incluye `pocket_moves`. CSS: `stats--money` en `views/home.css`.
  - El arnés simula `pocket_moves`, `money_overview` y `adjust_pocket`.

- [x] **Actualización automática** (02/10/2026). El usuario veía la versión nueva en el celular y la anterior en la computadora, porque la pestaña seguía abierta con el código viejo. Ahora la app compara la fecha de publicación (`Last-Modified` de `index.html`, que GitHub Pages pone igual en todos los archivos de cada publicación) con `document.lastModified` y se recarga sola si hay una versión más nueva. Revisa al abrir, al volver a la pestaña y 2 s después de cambiar de sección (como máximo una vez por minuto). No se recarga si hay una ventana abierta o se está capturando un ticket; lo intenta de nuevo en el siguiente momento. `core/pwa.js`: `updateAvailable()`, `applyUpdate()` (guarda en `sessionStorage` la versión intentada para no recargar en bucle). **Ya no hace falta pedirle al usuario que recargue dos veces** tras un push; solo la primera vez que un dispositivo recibe este cambio.
- Trabajo futuro posible, no comprometido: varias cuentas de banco con saldo propio (hoy hay un solo bolsillo "Tarjeta"); registrar retiros de cajero sin conexión; ocultar, renombrar o fusionar productos; índices para llaves foráneas (el advisor de rendimiento los marca como informativos; a escala de una casa no hacen falta); que más operaciones funcionen sin conexión (hoy solo tickets, fotos y listas de compras).
- No probado con datos reales por Claude: subida de fotos, abrir el `.xlsx` en Excel, restaurar un respaldo desde la app, instalación en iPhone. Si el usuario reporta algo de esto, empieza por ahí.
- Un cambio nuevo sigue el mismo ciclo: migración en `supabase/migrations/` si toca la base, probar con el arnés en 375 px y 1280 px, actualizar esta sección, commit y push.

### Notas técnicas generales

- Migraciones: guarda el SQL en `supabase/migrations/NNN_nombre.sql` y aplícalo con el conector Supabase (`apply_migration`, proyecto `oyawbeizugnkvvyqemcn`). Toda función nueva en `public` necesita `revoke execute ... from anon, public` y `grant execute ... to authenticated`.
- Para probar SQL como el usuario sin dejar datos: bloque `do $$ … $$` que fija `request.jwt.claims`, hace `set local role authenticated` y termina con `raise exception` para revertir.
- No envíes `total` al insertar o actualizar tickets.
- Para el autocompletado de productos usa `v_product_stats` (`last_price`, `unit`, `category_id`, `last_store_id`).

### Módulos del núcleo (bloque 3)

- Librerías fijadas: `@supabase/supabase-js@2.117.2` (en `core/supabase.js`) y `lucide@1.49.0` (en `ui/icon.js`). Son los únicos archivos que importan del CDN.
- `js/sections.js`: lista única de secciones (`path`, `label`, `short`, `icon`, `tab` = posición en la barra inferior, `primary`, `mobileOnly`, `block`, `view`). Al construir una sección: cambia su `view` por `() => import('./views/x.js')` y quita `block`. Las rutas aceptan parámetros (`/ticket/:id`).
- Contrato de una vista: `export default function (root, { route, params, query })`; puede ser `async` y puede devolver una función de limpieza. `root` es un `div.view` propio (grid con separación).
- `core/supabase.js`: `supabase`, `unwrap(resultado)`, `rpc(nombre, args)` (lanzan el error). `core/auth.js`: `onAuthChange`, `signIn`, `signOut` (solo cierra este dispositivo).
- `core/events.js`: `on(nombre, fn)` (devuelve la función para dejar de escuchar), `emit(nombre, detalle)`. Eventos: `auth:logout` (pide confirmar y cerrar sesión), `state:<clave>`.
- `core/store.js`: `getState()`, `setState(cambios)`, `watch(clave, fn)`. Claves: `user`, `month` (primer día del mes seleccionado, `aaaa-mm-01`).
- `core/format.js`: `money`, `todayISO`, `monthStart`, `addMonths`, `formatDate` (dd/mm/aaaa), `monthLabel`. `core/dom.js`: `h(tag, props, ...hijos)` (`onclick` etc. registran eventos; lo que no es propiedad del elemento va como atributo).
- `data/account.js`: `seedDefaults`. `data/months.js`: `ensureMonth`, `getMonthSummary`, `selectMonth(mes)` (asegura el mes y actualiza `month` en el store).
- `ui/`: `icon(nombre, tamaño)`, `toast(mensaje, 'info' | 'error')`, `openModal({ title, body, actions })` (devuelve el `<dialog>`; `actions`: `{ label, value, variant }`), `confirmDialog({ title, message, confirmLabel, danger })` → `Promise<boolean>`, `createMonthNav(onShift)` → `{ element, setMonth }`, `createShell`.
- CSS: `tokens.css` (colores claro/oscuro, espacios, radios), `components.css` (`btn` + `btn--primary/ghost/danger/icon`, `card`, `field`, `list`, `empty`, `month-nav`, `modal`, `toast`), `layout.css` (shell), `views/*.css` (cada archivo nuevo se enlaza en `index.html`).
- Pruebas: Claude no escribe la contraseña y el usuario no ve el panel de navegador de la app. Para probar vistas con sesión en local existe `.claude/dev-harness.js` (no se sube al repo; si falta, hay que recrearlo): simula PostgREST en memoria (`db`, `calls`, `rpc`) y monta el shell. Uso desde la consola de `http://localhost:8080/index.html`: `const hx = await import('/.claude/dev-harness.js'); window.hx = hx; await hx.mount('#/catalogos')`. Para tablas o RPC nuevos, agrega datos a `hx.db` / `hx.rpc`. La prueba con datos reales la hace el usuario en Pages.

### Extras (bloque 15)

- `categories.rule_group` (`need` | `want` | nulo). La regla 50/30/20 está activa si alguna categoría principal lo tiene; "Quitar la regla" los pone en nulo. `views/budgets-rule.js`: `ruleCard({ categories, spentOf, summary, reload })`. Ahorro = `savings_in + reserve_in` del mes.
- RPC: `export_rows(p_from, p_to)` → `{ items, incomes, payments, savings, moves }`; `backup_data()` → `{ app: 'gastos-casa', version: 1, exported_at, tables }` (todas las tablas de `backup_tables()`, sin `user_id`); `restore_data(p)` borra todo lo del usuario e inserta lo del respaldo en una sola transacción (columnas dinámicas, así que sirve para columnas futuras). **Si se agrega una tabla nueva hay que añadirla a `backup_tables()` en el orden correcto de dependencias.** Las fotos no van en el respaldo.
- `data/exports.js`: `exportSheets(desde, hasta)` → `[{ name, rows }]` (encabezados en español), `backupData()`, `restoreData(respaldo)`. `views/data.js`: antes de restaurar descarga un respaldo de lo actual, exige que no haya cambios pendientes, limpia la caché offline y recarga.
- `core/xlsx.js`: `buildWorkbook(hojas)` → `Blob` (escritor mínimo de `.xlsx`: zip sin compresión, cadenas en línea, números como número, sin estilos). `core/download.js`: `downloadFile(nombre, blob)`, `toCSV(filas)` (UTF-8 con BOM). `core/image.js`: `compressImage(archivo)`.
- Fotos: `data/photos.js` (`uploadTicketPhoto`, `removeTicketPhoto`, `deleteTicketWithPhoto`, `ticketPhotoUrl` con URL firmada de 1 hora) y en `data/tickets.js` `saveTicketPhoto(ticket, blob)` (encola `photo:<id>` si no hay red; el blob se guarda en IndexedDB), `clearTicketPhoto(ticket)` y `deleteTicket(ticket)` (ahora recibe el ticket, para borrar también su foto). `getTicket` devuelve `photo_path`. Ejecutores nuevos en `data/sync.js`: `upload_photo`, y `delete_ticket` borra la foto.
- `core/dom.js`: `h` y `fill` aplanan listas anidadas a cualquier profundidad.
- `sections.js`: sección `/datos` ("Datos y respaldo").
- El arnés simula `/storage/v1/` (`hx.files`), `export_rows`, `backup_data`, `restore_data` (`hx.restored`) y el usuario de prueba ya tiene `id`.

### Lista de compras (bloque 14)

- Una lista se guarda completa, como documento: `save_shopping_list(p)` recibe `{ id, name, store_id, status, ticket_id, items: [{ id, name, category_id, quantity, unit, unit_price, checked }] }`, borra los artículos que ya no vienen y es idempotente. Gana la última escritura (si dos dispositivos editan la misma lista a la vez, se conserva lo del último que guardó).
- `data/shopping.js`: `listShoppingLists()` (listas abiertas con `items`, con lo pendiente de la cola encima), `saveShoppingList(lista)` y `deleteShoppingList(id)` (devuelven `true` si se envió, `false` si quedó en cola; claves `list:<id>`), `listTotals(lista)` → `{ estimated, inCart, checked }`, `itemsToBuy(lista)` (los marcados, o todos si no hay ninguno marcado), `finishShoppingList(lista, comprados, ticketId)` (quita lo comprado; si no queda nada, la marca `done` con su `ticket_id`).
- `data/sync.js`: ejecutores nuevos `save_list` y `delete_list`.
- `views/shopping.js`: guarda sola 600 ms después de cada cambio y al salir de la vista; no escucha `data:changed` para no pisar lo que se está editando.
- `views/ticket.js`: con `?lista=<id>` arma el ticket con `itemsToBuy` y la tienda de la lista, y al guardar llama `finishShoppingList`.
- CSS: `views/shopping.css` (`shop-item`, `shop__add`); la barra inferior reutiliza `ticket__bar`.
- El arnés simula `shopping_lists` y `save_shopping_list`.

### Dashboard (bloque 13)

- `views/home.js` es el contenedor con pestañas; las vistas están en `views/dashboard/` (`general.js`, `day.js`, `month.js`, `alerts.js`). General siempre muestra el mes en curso (no el mes seleccionado); Mes usa el mes del store; Día guarda el día en la URL.
- `monthly_trend(p_months, p_until)` → `[{ month, spent, incomes }]`, del más antiguo al más reciente. La gráfica recorta los meses vacíos del principio pero muestra al menos 6.
- Proyección de fin de mes = gastado / día del mes × días del mes; solo desde el día 5 (antes se muestra "—").
- "Gastos hormiga" = la categoría de gasto cuyo nombre contiene "hormiga". Si el usuario la renombra o elimina, la tarjeta desaparece.
- Alertas (`buildAlerts`): pagos vencidos o por vencer (`dueState` y `dueText` de `data/payments.js`), presupuestos al 80% y 100% (`budgetStatus`), proyección arriba del plan y meses terminados sin cerrar. Cada alerta enlaza a su sección.
- `data/dashboard.js`: `getTrend(meses)`, `categoryBreakdown(articulos, categorias)`. `data/categories.js`: `NO_CATEGORY`. `views/day-detail.js`: `dayDetail(dia)` → `{ total, nodes }` (lo usan Calendario y la vista Día).
- `ui/chart.js`: `trendChart({ label, labels, series, formatY, formatTick })` (dos series con `--chart-1` y `--chart-2`) y `donutChart({ label, segments, formatValue, center, onSelect })` (máximo 5 categorías + "Otras", con los colores propios de cada categoría y la lista al lado como leyenda). `ui/stat.js`: `statTile({ label, value, hint, featured })`, `deltaBadge(actual, anterior)` (subir = rojo, bajar = verde, porque se usa para gasto).
- Colores de series validados con `validate_palette.py` de la skill `dataviz` (se ejecuta con `PYTHONIOENCODING=utf-8`): claro `#1f8a5f` / `#2a78d6` sobre `#ffffff`, oscuro `#2fa876` / `#4f8fe0` sobre `#171e25`. Verde + naranja no pasa la prueba de daltonismo en claro.
- `core/dom.js`: `fill(padre, ...hijos)` reemplaza el contenido ignorando `null` y `false`. **Úsalo en vez de `replaceChildren` cuando algún hijo sea condicional** (`replaceChildren` y `append` nativos escriben el texto "null").
- `core/format.js`: `wholeMoney`, `addDays`. CSS en `views/home.css`: `stat`, `delta`, `alert`, `trend`, `donut`, `chart--donut`, `legend__line`.
- Al probar en local tras editar CSS o módulos ya cargados, Chrome puede servirlos de su caché en memoria: fuerza con `fetch(archivo, { cache: 'reload' })` y recarga, o navega con otra query.
- El arnés tiene `hx.seedDemo()` (datos de demostración para todas las secciones), `hx.trend` y simula `monthly_trend` y un `month_summary` calculado.

### Ahorro y reserva (bloque 12)

- `data/savings.js`: `listGoals()` (de `v_savings_goals`), `monthlyQuota(meta)` (cuota de este mes = (faltante + guardado este mes) / meses restantes), `saveGoal` (upsert), `deleteGoal`, `listGoalMovements`, `addGoalMovement` (monto positivo = guardar, negativo = retirar), `deleteGoalMovement`, `listReserveMovements`, `addReserveMovement`, `deleteReserveMovement`, `listOpenMonths()` (meses terminados sin cerrar, con su sobrante), `closeMonth(mes)`, `reopenMonth(mes)`.
- `reopen_month(p_month)` borra el movimiento de cierre y quita `closed_at`. `close_month` solo acepta meses terminados y una vez por mes; si el sobrante es negativo, descuenta de la reserva.
- Guardar en una meta o en la reserva baja el disponible del mes de la fecha del movimiento; retirar o usar lo regresa. Eliminar una meta borra sus movimientos (el dinero vuelve al disponible de esos meses); archivar la conserva fuera de la cuota del mes.
- Las tarjetas de metas reutilizan las clases `obligation` y `quincena`; `views/savings.css` solo agrega `goal__stats` y `goal__actions`.
- El arnés simula `v_savings_goals` (calculada), `savings_goals`, `savings_movements`, `reserve_movements`, `close_month`, `reopen_month`, y `hx.summaries[mes]` para fijar el resumen de un mes. Sus filtros ya entienden `eq`, `lt`, `lte`, `gt`, `gte` e `is.null`.

### Pagos del mes (bloque 11)

- RPC nuevas: `month_obligations(p_month)` (pagos del mes con `paid`, `pending` y `payments[]`), `pay_obligation(p)` (`{ id, obligation_id, amount, paid_on, payment_method_id, note }`, idempotente por `id`), `undo_payment(p_payment)`, `save_recurring(p)`, `delete_recurring(p_id)`, `save_msi_plan(p)` (solo planes sin ticket).
- Regla del dinero al pagar: un pago **fijo** o **único con categoría** crea un ticket (cuenta como gasto y sale en Historial y Calendario) y guarda su `ticket_id`; un pago de **tarjeta**, **MSI** o **único sin categoría** solo baja el disponible. `undo_payment` borra también el ticket generado. Tarjeta y MSI no se pueden pagar con un método de crédito.
- Editar el monto o la fecha de un pago del mes lo marca `manual` (no lo pisa `ensure_month`); en tarjetas, `useAutomaticAmount(id)` vuelve al cálculo del corte. `save_recurring` borra los pagos futuros no pagados y no manuales del gasto fijo para que se regeneren; `delete_recurring` conserva como pago único los que ya tienen pagos.
- `data/payments.js`: `OBLIGATION_KINDS`, `FREQUENCIES`, `listObligations(mes)`, `createsExpense(pago)`, `payObligation`, `undoPayment`, `createObligation`, `updateObligation`, `deleteObligation`, `useAutomaticAmount`, `listRecurring`, `saveRecurring`, `deleteRecurring`, `listMsiPlans`, `saveMsiPlan`, `deleteMsiPlan`.
- `core/format.js`: `monthsBetween(desde, hasta)`, `daysBetween(desde, hasta)`. `openFormModal` ahora devuelve `{ close }`.
- Avisos de vencimiento (en `views/payments/month.js`, `dueTag`): "Vencido", "Vence hoy", "Vence mañana / en N días" (hasta 5). El dashboard debe mostrar estos mismos avisos.
- CSS: `views/payments.css` (`obligation`). La tarjeta de resumen reutiliza `plan` y `day__header`.
- El arnés simula `ensure_month` (fijos y MSI), `month_obligations`, `pay_obligation`, `undo_payment`, `save_recurring`, `delete_recurring`, `save_msi_plan` y sus tablas.

### Presupuestos (bloque 10)

- `budget_overview(p_month)` → `{ plan: { total_budget, split_mode, closed_at } | null, uncategorized, rows: [{ category_id, budget, q1_budget, spent, spent_q1, previous, average }] }`, una fila por cada categoría de gasto. En una categoría principal, `spent`/`previous`/`average` incluyen sus subcategorías. `average` = gasto de los 3 meses anteriores entre los meses con datos. `spent_q1` = gastado del día 1 al 15 (las mensualidades MSI caen en la primera quincena).
- `set_budget(...)`: monto ≤ 0 quita el presupuesto (y los de sus subcategorías si es principal). Mantiene la regla **presupuesto de la categoría ≥ suma de sus subcategorías**: si no se cumple, sube el de la principal y devuelve el nuevo monto (si no, `null`). `q2 = amount − q1_amount`; con `q1_amount` nulo la UI reparte mitad y mitad.
- `month_plans.total_budget` ("Total a usar") es independiente de lo asignado a categorías; la UI muestra cuánto falta por asignar o cuánto se pasa.
- `data/budgets.js`: `getBudgetOverview(mes)`, `budgetStatus(gastado, presupuesto)` → `'none' | 'ok' | 'near' | 'over'` (80% y 100%), `setBudget(mes, categoria, monto, primeraQuincena)`, `saveMonthPlan(mes, valores)`.
- `ui/budget-bars.js`: `budgetBars({ spent, budget, previous, status, label })`, `barsLegend()`, `statusMeter(valor, total, status)`. Colores de estado: acento (bien), `--warning` (≥80%), `--danger` (≥100%), siempre acompañados de etiqueta de texto. El dashboard debe reutilizarlos para sus alertas.
- CSS nuevo en `components.css`: `bars`, `legend`, `tag--danger`, `notice--warning`, `form__extra`; `views/budgets.css` (`plan`, `budget`, `quincenas`).
- El arnés simula `budget_overview`, `set_budget`, `budgets` y `month_plans`.

### Ingresos (bloque 9)

- `data/incomes.js`: `listIncomes(mes)`, `saveIncome(ingreso)` (upsert por `id` generado en el cliente; devuelve la fila), `deleteIncome(id)`. No se usa `incomes.note`. La categoría es obligatoria y el método ("Recibido en") opcional, sin tarjetas de crédito.
- Patrón de vista por mes con formulario en ventana (`views/incomes.js`): `createMonthNav` + `selectMonth`, `load(mes)` que vuelve a pintar todo, `watch('month')` y `on('data:changed')`, y `openFormModal` con `remove`. Sirve de modelo para Pagos y Ahorro.
- CSS: `row--padded` (fila con margen derecho, para filas sin botones).
- El arnés ya trata un POST con `id` existente como actualización (upsert) y tiene la tabla `incomes`.

### Calendario (bloque 8)

- `day_detail(p_day)` devuelve los tickets del día con la misma forma que `search_tickets` (sirven para `ticketRow`) y además `discount` y, en cada artículo, `category_id`, `quantity`, `unit`, `unit_price`, `amount` y `net_amount` (con el descuento prorrateado). Sirve también para la vista "Día" del dashboard.
- `data/calendar.js`: `getDailyTotals(mes)` (de `daily_totals`: `[{ day, total, tickets }]`), `getDayDetail(dia)`.
- `ui/calendar.js`: `createCalendar(onSelect)` → `{ element, render({ month, totals: Map(día → { total, tickets }), selected, today }) }`. Semana en lunes; el nivel de color es por rango (cuartiles), no proporcional, para que una compra grande no aplane el resto.
- `views/calendar.js`: `breakdown(tickets, categorias)` agrupa por categoría principal con sus subcategorías (interno; si el dashboard lo necesita, moverlo a `data/`).
- `core/format.js`: `compactMoney` (sin centavos; `$13.0k` desde 10,000), `dayLabel` ("Jueves, 1 de octubre"), `weekdayIndex` (lunes = 0).
- El arnés simula `daily_totals` y `day_detail`.

### Historial (bloque 7)

- `search_tickets(p)` recibe `{ from, to, store_id, payment_method_id, category_id, text, limit, offset }` (todo opcional; cadena vacía = sin filtro) y devuelve `{ count, total, rows }`. `category_id` de una categoría principal incluye sus subcategorías; `text` busca sin acentos en artículos, tienda y nota. Cada fila trae `stores`, `payment_methods`, `ticket_items(name)` y `msi_plans(months)`.
- `data/tickets.js`: `listTickets(filtros)` ahora llama a `search_tickets` y devuelve `{ count, total, rows }` (lo usan Inicio e Historial; el Calendario puede usarlo con `from = to = día`). También exporta `itemAmount(item)` y `ticketTotals(ticket)` → `{ subtotal, total }`.
- `data/products.js`: `listProducts()` (todas las columnas de `v_product_stats`, solo con compras), `getProductHistory(id)` (de `v_item_history`, por fecha).
- `views/ticket-detail.js`: `openTicketDetail(id)`; `ui/ticket-row.js`: `ticketRow(ticket, onOpen)` ahora es un botón que llama `onOpen(id)`.
- `ui/chart.js`: única entrada de Chart.js (`chart.js@4.5.1/auto`). `lineChart({ label, points: [{ x, y }], formatX, formatY })` → `{ element, destroy }` (eje X lineal con tiempos; una serie en color de acento, sin leyenda). Las gráficas siguientes (dona, barras, tendencia) van en este módulo y deben seguir la guía de la skill `dataviz` (una serie = un color, texto en tokens de texto, rejilla fina, tabla equivalente a la vista). Hay que destruir la gráfica al cerrar la vista o la ventana.
- `ui/category-select.js`: `categorySelect(arbol, valor, { fallback, placeholder, required })`. `core/format.js`: `dateToTime`, `timeToISO`.
- CSS nuevo en `components.css`: `meter`, `detail`, `mini-stats`, `chart`, `table`, `tag--good`, `button.list__item`; `views/history.css` (`filters`).
- Pendiente a futuro: ocultar, renombrar o fusionar productos (hoy solo se listan los que tienen compras).
- El arnés simula `search_tickets` y `v_item_history`.

### PWA y offline (bloque 6)

- `sw.js` no lleva lista de archivos. La página: red primero, y caché si no hay red o tarda más de 3 s; en ese caso todo lo demás de esa carga sale de la caché. Si la página salió de la red, los archivos propios van a la red (revalidando) con caída a caché a los 8 s. CDN `cdn.jsdelivr.net`: caché primero. Al entrar con conexión, `app.js` (`prepareOffline`) importa todas las vistas de `sections.js`, precarga los catálogos y pide al service worker guardar todo lo cargado. **Por eso toda vista debe ser alcanzable con imports estáticos desde el `view()` de su sección** (nada de `import()` dinámico dentro de las vistas) y todo CSS debe estar enlazado en `index.html`. Solo cambia `CACHE` en `sw.js` si cambia la estructura de la caché.
- `core/offline.js`: `cachedRead(clave, fetcher)` (red con límite de 8 s; si no hay red devuelve lo último guardado en IndexedDB), `isNetworkError`, `OfflineError`, `withTimeout`, cola (`putOperation`, `removeOperation`, `listOperations`), `clearOffline` (se llama al cerrar sesión). **Toda lectura nueva de `data/` debe pasar por `cachedRead`** con una clave propia.
- `core/supabase.js`: `unwrap` convierte los fallos de red en `OfflineError` ("Sin conexión a internet.") y el duplicado en mensaje claro. `ensureMonth` y `seedDefaults` ignoran los fallos de red.
- `data/sync.js`: `enqueue(clave, tipo, payload)`, `dropPending(clave)`, `pendingOperations()`, `flush()` (se dispara al entrar, al volver la conexión y al volver a la pestaña), `announce()`. Para que otra operación funcione sin conexión: agrega su ejecutor idempotente en `executors` y encólala cuando la llamada directa falle por red (patrón de `saveTicket`/`deleteTicket`, que devuelven `true` si se envió y `false` si quedó en cola). Una misma clave reemplaza a la anterior. Solo los tickets se encolan; catálogos y demás requieren conexión.
- Eventos nuevos: `sync:status` (`{ online, syncing, pending, failed }`), `sync:sent` (cantidad), `data:changed` (las vistas que muestran datos deben recargar al recibirlo, como `home.js`).
- `data/tickets.js`: `getTicket` devuelve primero el pendiente de la cola; `listTickets` oculta los que tienen operación pendiente; `listPendingTickets()` los devuelve con `pending` (texto de la etiqueta).
- `core/auth.js`: sin conexión y con el token vencido, usa el usuario guardado para no mandar al login.
- `core/pwa.js`: `registerServiceWorker`, `cacheLoadedFiles`, `canInstall`, `install`, `needsManualInstall` (iPhone). `ui/install-button.js`: `installButton()` (devuelve `null` si no se puede instalar).
- `ui/shell.js`: `setStatus(estado)` pinta el indicador (`.chip`). CSS nuevo: `chip`, `tag--warning`, tokens `--warning`/`--warning-soft`.
- El arnés tiene `hx.setOnline(false|true)` para simular la conexión; un RPC simulado que lanza error responde 400.
- Los iconos PNG se generaron con System.Drawing desde PowerShell (misma figura que `icon.svg`).
- Si tras un push la publicación de Pages se queda en cola más de unos minutos (`gh run list --repo Souls-Nao/gastos-casa`), cancélala con `gh run cancel <id>` y pide otra con `gh api -X POST repos/Souls-Nao/gastos-casa/pages/builds`. Para esperar, sondea la URL publicada con un bucle en Bash.

### Captura de tickets (bloque 5)

- `save_ticket(p)` recibe `{ id, purchased_on, purchased_at, store_id, payment_method_id, discount, note, items: [{ id, name, category_id, quantity, unit, unit_price }], msi: null | { months, first_month } }`. Borra los artículos que ya no vienen, actualiza categoría y unidad del producto con lo último capturado, y al cambiar el plan MSI borra sus pagos no pagados para que `ensure_month` los regenere. Una sola llamada = una entrada de la cola offline del bloque 6.
- `data/tickets.js`: `getTicket(id)` (devuelve la misma forma que recibe `save_ticket`), `listTickets({ from, to, limit })` (con `stores`, `payment_methods`, `ticket_items(name)`, `msi_plans(months)` embebidos; el bloque 7 le agrega filtros), `saveTicket`, `deleteTicket` (ambas llaman `ensureMonth`). `data/products.js`: `listProducts()` (de `v_product_stats`, sin ocultos, más comprados primero).
- `views/ticket.js`: estado = el mismo objeto que se envía. Borrador automático en `localStorage` (`gastos:ticket-draft`, solo tickets nuevos) y último método de pago (`gastos:last-payment-method`). La categoría es obligatoria en cada artículo. MSI solo con métodos de tipo crédito; el primer pago se calcula con el día de corte y de pago de la tarjeta. No se usa `tickets.title`.
- `core/`: `navigate(ruta)` en `router.js`; `readLocal`, `writeLocal`, `removeLocal` en `local.js`; `nowTime`, `monthEnd`, `normalize` (sin acentos, minúsculas) en `format.js`.
- `sections.js`: una sección con `hidden: true` es ruta sin entrada en menús; `parent` indica qué entrada resaltar.
- `ui/`: `autocomplete(input, { search, render, onSelect })` (devuelve el contenedor), `categorySelect(arbol, valor, fallback)`, `selectInput(opciones, valor, props)`, `ticketRow(ticket)` (fila enlazada a la edición; reutilizable en Historial y Calendario).
- CSS nuevo en `components.css`: `notice`, `check`, `autocomplete`, `section-title`, `list__empty`; `views/ticket.css`.
- El arnés `.claude/dev-harness.js` ya simula `tickets`, `v_product_stats` y `save_ticket`.

### Módulos de catálogos (bloque 4)

- `data/crud.js`: `listRows(tabla, ...orden)`, `insertRow`, `updateRow` (traducen el error de nombre duplicado), `deleteRow`, `usageCount(tabla, id)`, `nextOrder(filas)`. Cada entidad expone además `delete…` y, si aplica, `…Usage(id)`.
- Al eliminar: una categoría arrastra sus subcategorías y presupuestos, y deja sin categoría los artículos/ingresos que la usaban; una tienda deja sus tickets sin tienda. La UI debe mostrar "Sin categoría" / "Sin tienda" cuando el dato es nulo.
- `ui/modal.js`: `openModal` devuelve `{ close }` y acepta `onClose(valor)`; no dependas del evento `close` del `<dialog>` (Chromium no lo dispara con la página oculta). `openFormModal` acepta `remove: { label, run }` (`run` devuelve `true` si eliminó) y `confirmRemoval(nombre, detalle)` → `Promise<boolean>` es la confirmación estándar para eliminar.
- `data/categories.js`: `listCategories`, `categoryTree(filas, kind)` (categorías con `children`), `createCategory`, `updateCategory(categoria, cambios)` (propaga el color a las subcategorías), `reorderCategories(ordenadas)`. Las subcategorías no tienen icono y heredan el color.
- `data/stores.js`: `listStores`, `createStore(nombre)`, `updateStore`. `data/units.js`: `listUnits`, `createUnit(nombre)`, `updateUnit`. `ticket_items.unit` sigue siendo texto: `units` solo alimenta el selector.
- `data/payment-methods.js`: `PAYMENT_TYPES` (`label`, `icon` por tipo), `listPaymentMethods`, `createPaymentMethod`, `updatePaymentMethod` (ambas llaman `ensureMonth` para refrescar los pagos de tarjeta).
- En los selectores de captura hay que filtrar lo oculto (`hidden`), incluidas las subcategorías de una categoría oculta.
- `ui/`: `field(label, control, hint)`, `fieldGroup`, `textInput(props)`; `openFormModal({ title, body, submitLabel, onSubmit })` (muestra el error que lance `onSubmit` y cierra si termina bien); `tabs(items, actual)`; `listRow({ leading, title, subtitle, hidden, actions })`, `iconButton`, `hideButton`; `categoryIcon(categoria, tamaño)`; `colorPicker(valor)` e `iconPicker(valor)` → `{ element, value }`.
- CSS nuevo en `components.css`: `form`, `tabs`, `toolbar`, `row`, `tag`, `category-icon`, `swatches`, `icon-grid`; `base.css`: `visually-hidden`.
