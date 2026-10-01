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

**Tablas:** `categories` (con `parent_id` para subcategorías, `kind` expense/income, `hidden`, `icon`, `color`, `sort_order`), `stores`, `payment_methods` (`type` cash/debit/credit/transfer/voucher, `closing_day`, `due_day`, `credit_limit`), `products`, `tickets`, `ticket_items` (`amount` = cantidad × precio, columna generada), `msi_plans`, `incomes`, `month_plans` (`total_budget`, `opening_balance`, `split_mode` month/biweekly, `closed_at`), `budgets` (`amount`, `q1_amount`; q2 = amount − q1), `recurring_expenses` (monthly/bimonthly/quarterly/semiannual/yearly), `obligations` (kind card/msi/recurring/custom, `manual`), `obligation_payments` (`ticket_id` si el pago generó un gasto), `savings_goals`, `savings_movements` (+ depósito / − retiro), `reserve_movements` (kind month_close/manual), `shopping_lists`, `shopping_list_items`, `units` (`name`, `hidden`, `sort_order`; migración 003).

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
- [ ] Bloque 6 — PWA y offline ← **siguiente**
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
