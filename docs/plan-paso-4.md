# Plan del paso 4: Vencimientos

Está escrito para que una sesión nueva lo ejecute sin el historial de la conversación en que se armó. Las decisiones de producto ya están **confirmadas por el usuario** (sección "Decisiones confirmadas"); no hace falta volver a preguntarlas. Se trabaja en dos etapas: primero la **etapa 0** (mover el código compartido, con los tests de clientes en verde) y recién después las secciones A a E.

## Antes de empezar

1. Leé `CLAUDE.md` (raíz del repo; está en `.gitignore`, así que existe solo en la copia local) y `AGENTS.md`. Tienen las reglas del proyecto y las decisiones de los pasos 1 a 3. Este plan no las repite. Prestá atención a:
   - **Git:** no corras comandos que modifiquen el repo o el árbol de trabajo (`stash`, `checkout`, `reset`, `restore`, `commit`, …) sin preguntar. Solo lectura está bien. **Sin commits.**
   - "Decisiones de implementación (paso 3: Clientes)": el patrón de Server Actions (`fallo()` con `refresh()`, `revalidatePath('/', 'layout')` + `redirect()` fuera del `try`, avisos `?ok=`, confirmación por URL, `<select>` nativo, errores por idioma) y la nota sobre rutas ocultas en el DOM en los e2e.
   - "Errores de formularios sin JS (aceptado)": sin JS se exige solo el caso exitoso de cada formulario; los errores no se ven en producción.
   - "Pendiente para el deploy": en producción, `notFound()` y el redirect de un 401 responden 200.
2. Leé el `CLAUDE.md` de la API (`../contable-api/CLAUDE.md`): la entidad Vencimiento, "Vencimientos" e "Impuestos" en endpoints, y "Decisiones de implementación (vencimientos)".
3. Verificá que el árbol esté limpio (`git status`) y que la API esté arriba en `E2E_API_URL` con `seed:demo` cargado y `LOGIN_RATE_LIMIT` alto (p. ej. 100) en su `.env`.
4. Corré la verificación completa antes de tocar nada (ver "Verificación final"), para tener una base verde. `test:e2e:prod` hoy tiene 1 fallo conocido, el del 404 (ver CLAUDE.md).
5. Si hay dudas sobre APIs de Next, leé `node_modules/next/dist/docs/`. Next es 16.4.6, con Cache Components.

## Decisiones confirmadas (por el usuario, 2026-11-22)

1. **Pestañas y filtro por defecto.** El listado tiene pestañas, en este orden: **Vencidos / Pendientes / Próximos 30 días / Presentados / Todos**. La pestaña por defecto es **"Pendientes"** (al día, `estado=pendiente` de la API), ordenada por fecha de vencimiento ascendente (el orden fijo de la API). Cada pestaña muestra su cantidad, sacada de **una sola llamada** a `GET /estadisticas` (ver B). "Próximos 30 días" usa `GET /vencimientos/proximos`.
2. **Tarjetas del Inicio como links**, todas, incluida "Próximos 30 días": "Clientes activos" → `/clientes`; "Pendientes (al día)" → `/vencimientos` (es la pestaña por defecto); "Vencidos" → `/vencimientos?estado=vencido`; "Presentados" → `?estado=presentado`; "Próximos 30 días" → `?estado=proximos`. Como la pestaña "Próximos 30 días" usa el mismo endpoint que cuenta la API (`proximos30Dias` "igual que /vencimientos/proximos"), el número de la tarjeta coincide con el listado.
3. **Vencimientos desde el cliente.** En el detalle del cliente, "Ver vencimientos" (`/vencimientos?cliente=<id>&estado=todos`) y, si está activo, "Nuevo vencimiento" (`/vencimientos/nuevo?cliente=<id>`, con el cliente ya elegido). No se agrega un listado de vencimientos dentro del detalle del cliente.
4. **Período en el alta:** campo de texto "Período" con la ayuda del formato según la periodicidad, **validado en el front y en la API**. Sin JS, la ayuda dice "AAAA-MM para impuestos mensuales (por ejemplo, 2026-10), AAAA para anuales (por ejemplo, 2025)". Con JS, al elegir el impuesto la ayuda y el `placeholder` pasan al formato de ese impuesto ("Formato AAAA-MM, por ejemplo 2026-10"). El `<select>` de impuestos muestra la periodicidad: "IVA (mensual)", "Ganancias (anual)". La action valida el formato contra la periodicidad del impuesto elegido (sale de `GET /impuestos`) antes de llamar a la API, y la API vuelve a validarlo (su 400 se muestra como "Revisá los datos").
5. **Código compartido primero, en una etapa separada** (etapa 0): se mueve a módulos comunes antes de escribir nada de vencimientos, sin cambiar el comportamiento, y con los tests de clientes (unitarios y e2e) en verde antes de seguir.

**Decisiones tomadas al escribir el plan** (no las pidió el usuario; se pueden revisar):
- "Ver vencimientos" desde el cliente abre la pestaña **Todos**, no la de por defecto: para un solo cliente interesa la historia completa.
- Las cantidades de las pestañas son **totales del estudio**: `GET /estadisticas` no acepta cliente, impuesto ni fechas. Por eso **solo se muestran cuando no hay otros filtros activos**; con un filtro de cliente, impuesto o fechas, las pestañas van sin número (si no, el número no coincidiría con lo listado).
- `GET /vencimientos/proximos` acepta solo `page` y `limit`. En la pestaña "Próximos 30 días" no se pueden combinar los filtros de cliente, impuesto ni fechas: el formulario no los muestra, y el link de esa pestaña no los conserva.

## Hechos de la API (verificados en `../contable-api` y en `src/lib/api/schema.d.ts`)

Todo se filtra por el `adminId` del token. Un vencimiento de otro estudio o inexistente da 404, y un `:id` que no es UUID da 400.

| Endpoint | Notas |
|---|---|
| `GET /vencimientos?page&limit&estado&clienteId&impuestoId&desde&hasta` | `estado` filtra por **estado actual**: `pendiente` (no vencido), `vencido` o `presentado`; sin él vienen todos. `desde`/`hasta` filtran `fechaVencimiento`, inclusive (`YYYY-MM-DD`, la fecha tiene que existir). `desde > hasta` da 400 "desde no puede ser posterior a hasta". Ordena por `fechaVencimiento` ascendente, después por `id`. Incluye clientes dados de baja. Responde `{ data, total, page, limit }`. |
| `GET /vencimientos/proximos?page&limit` | Solo `page` y `limit`: **no** filtra por cliente, impuesto ni fechas. No presentados que vencen entre hoy y hoy + 30 días (Argentina), por fecha. **Excluye clientes dados de baja.** Responde paginado como el listado. |
| `GET /estadisticas` | `vencimientos: { pendientes, vencidos, presentados, proximos30Dias }`: totales del estudio sin rango. Los tres primeros incluyen clientes dados de baja y coinciden con `GET /vencimientos?estado=…`; `proximos30Dias` coincide con `/vencimientos/proximos`. "Todos" = `pendientes + vencidos + presentados`. |
| `GET /vencimientos/:id` | Detalle. |
| `POST /vencimientos` | Body: `clienteId`, `impuestoId`, `fechaVencimiento` (`YYYY-MM-DD`), `periodo` y `notas` opcional (≤ 2000; vacía → `null`). Siempre se crea `pendiente`. Errores: cliente ajeno o inexistente → 404 "Cliente no encontrado"; impuesto inexistente → 404 "Impuesto no encontrado"; cliente dado de baja → 409 "El cliente está dado de baja"; duplicado `(cliente, impuesto, periodo)` → 409 "Ya existe un vencimiento de ese impuesto para ese cliente y período"; período con un formato que no corresponde a la periodicidad → 400. |
| `PATCH /vencimientos/:id` | Acepta solo `estado` (`pendiente` \| `presentado`), `fechaPresentacion` y `notas`; lo que no se manda no cambia. Al quedar `presentado`: `fechaPresentacion` = la enviada, o la que ya tenía, o hoy (Argentina); no puede ser futura (400). Al quedar `pendiente`: se borra, y mandarla da 400. `notas` vacía o `null` → `null`. **No se pueden cambiar** cliente, impuesto, fecha ni período: no hay edición de esos datos. |
| `DELETE /vencimientos/:id` | Borrado físico. 204; un segundo intento da 404. |
| `GET /impuestos` | Cualquier usuario autenticado. Ordenado por nombre. `{ id, codigo, nombre, periodicidad: 'mensual' \| 'anual' }`. Seed: IVA, IIBB, Autónomos y Monotributo (mensuales); Ganancias y Bienes Personales (anuales). |

- `VencimientoResponseDto`: `id`, `clienteId`, `cliente` (`{ id, razonSocial, cuit }`), `impuestoId`, `impuesto` (completo), `fechaVencimiento`, `periodo`, `estado` (guardado), **`estadoActual`** (`pendiente` \| `presentado` \| `vencido`), `fechaPresentacion` (o `null`), `notas` (o `null`), `createdAt`, `updatedAt`.
- **El estado que se muestra es siempre `estadoActual`**; nunca se recalcula en el front (CLAUDE.md, "Fechas").
- `periodo`: `YYYY-MM` si el impuesto es mensual, `YYYY` si es anual.
- Tipos que ya existen en `src/lib/api/types.ts`: `Vencimiento`, `EstadoVencimiento` (= `estadoActual`), `CrearVencimientoBody`, `ActualizarVencimientoBody`, `VencimientosQuery`, `Impuesto`, `Paginado<T>`. Si hace falta, agregá alias (por ejemplo `Periodicidad = Impuesto['periodicidad']`); no edites `schema.d.ts`.
- **Idioma de los errores:** los 404 y 409 vienen en español. Los 400 pueden venir en inglés (class-validator) o en español (los del service). Misma regla que en clientes: validar en el front, mostrar el mensaje de la API solo en los 409 (y en los 404 del alta, ver C), y convertir los 400 en "Revisá los datos".
- **`seed:demo`:** el admin de demo tiene vencimientos de los meses −5 a +1, con fechas relativas a hoy: siempre hay presentados, vencidos, pendientes y próximos. Los tests que leen comparan contra la API, no contra números fijos.

## Etapa 0. Código compartido (antes de vencimientos)

Objetivo: que vencimientos pueda reusar lo genérico de clientes **sin cambiar el comportamiento de clientes**. Es un paso separado: se termina y se verifica antes de crear cualquier archivo de vencimientos.

- **Helpers de Server Actions** → `src/lib/acciones.ts` (`import 'server-only'`): `fallo()` (con su `refresh()` y el comentario que explica por qué), `estadoDeError()` (generalizado: que reciba también qué hacer con un 404, porque en el alta de vencimientos el 404 va a un campo y en el resto es `notFound()`; el default sigue siendo `notFound()`) y un `terminar(url)` genérico con `revalidatePath('/', 'layout')` + `redirect()`. `(panel)/clientes/actions.ts` los importa; un archivo `'use server'` solo puede exportar funciones async, por eso no pueden quedarse ahí.
- **Formularios** → `src/lib/formularios.ts` (puro): `EstadoFormulario`, `hayErrores`, `leerCampos` y los `MENSAJES` genéricos ("Revisá los datos", etc.). Lo específico de clientes (`validarCliente`, `CAMPOS_CLIENTE`, …) queda en `lib/clientes.ts`.
- **Paginación y URL** → `src/lib/paginacion.ts` (puro): el parseo de `pagina`, el "primero si está repetido", `calcularPaginacion` y `esUuid`.
- **Componentes de campo** → `components/formularios/campo.tsx` (`Campo`, `ariaCampo`, `MensajeError`, `claseSelect`), desde `components/clientes/campo.tsx`. Actualizá los imports de clientes. Si la paginación del listado de clientes es un componente, movelo también a `components/formularios/` o `components/panel/`.
- Los tests unitarios de lo que se mueve van con el código (`lib/paginacion.test.ts`, `lib/formularios.test.ts`), **verificando lo mismo** que hoy verifica `lib/clientes.test.ts`.
- **Verificación de la etapa 0** (todo en verde antes de seguir): `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run test:e2e` (la suite entera, en particular `clientes-lectura` y `clientes-edicion`) y `npm run test:e2e:prod` con el mismo único fallo conocido. Reportale al usuario el resultado antes de pasar a la sección A.

## A. Navegación e Inicio

- En `components/panel/nav-links.tsx`, "Vencimientos" pasa a ser un link a `/vencimientos`, activo también en sus subrutas. Se va el `<span aria-disabled>` con "Próximamente".
- Decisión 2: las cinco tarjetas del Inicio (`(panel)/page.tsx`) llevan un link (destinos en la decisión 2). Que toda la tarjeta sea clickeable, con un `<Link>` que tenga un nombre accesible claro (por ejemplo "Ver vencidos", "Ver próximos 30 días"), y foco visible. Los e2e del Inicio buscan las tarjetas por `data-testid`: no lo cambies. Armá los destinos con `urlVencimientos()` (sección B), no a mano.
- Decisión 3: en `(panel)/clientes/[id]/page.tsx`, los links "Ver vencimientos" y "Nuevo vencimiento" (este solo si el cliente está activo).

## B. Listado `/vencimientos`

- **Archivo:** `src/app/(panel)/vencimientos/page.tsx`, con `export const instant = false` (`instant.test.ts` ya recorre `(panel)`).
- **Parámetros de la URL** (en español): `estado` (la pestaña: `vencido` \| `pendiente` \| `proximos` \| `presentado` \| `todos`; default `pendiente`, que se omite en la URL), `cliente` (UUID), `impuesto` (UUID), `desde`, `hasta` (`YYYY-MM-DD`) y `pagina` (entero ≥ 1).
  - Se traducen a la API: `estado` (ausente si es `todos`), `clienteId`, `impuestoId`, `desde`, `hasta`, `page` y `limit` = `POR_PAGINA = 20`.
  - Con `estado=proximos` se llama a `GET /vencimientos/proximos` solo con `page` y `limit`; `cliente`, `impuesto`, `desde` y `hasta` se ignoran (ver "Decisiones tomadas al escribir el plan").
- **Pestañas** (`components/vencimientos/pestanas.tsx`, Server Component): una `<nav aria-label="Estado">` con cinco links (funcionan sin JS), `aria-current="page"` en la activa. Cada link conserva `cliente`, `impuesto`, `desde` y `hasta` (salvo el de Próximos) y vuelve a la página 1. Texto: "Vencidos (3)", "Pendientes (8)", "Próximos 30 días (5)", "Presentados (40)", "Todos (51)", con los números de `GET /estadisticas` (`vencimientos.*`; "Todos" es la suma de los tres estados). La cantidad va también en un `aria-label` legible ("Vencidos, 3"). Sin otros filtros activos se muestran los números; con alguno, las pestañas van sin número. "Vencidos" con al menos uno se destaca en `destructive`, como la tarjeta del Inicio. En el celular, las pestañas hacen scroll horizontal dentro de su contenedor (no la página) o bajan en dos filas; probá a 390 px.
  - `GET /estadisticas` se pide **una vez** por render, en paralelo con el listado. Si falla, las pestañas se muestran sin número (no rompe el listado).
  - Sin `estado` ni otros filtros y con los cuatro conteos en 0 → el estudio no tiene vencimientos ("Todavía no cargaste vencimientos"): no hace falta una llamada extra.
  - Un `cliente` o `impuesto` que no es UUID se ignora (si no, la API da 400). Un `estado` inválido vale el default; una `pagina` inválida vale 1.
  - **Fechas:** validá en el front que sean `YYYY-MM-DD` y que existan (sin `new Date()`: con regex y días por mes, en `lib/fechas.ts`), y que `desde ≤ hasta` (comparando los strings). Si algo falla, **no llames a la API**: mostrá un `role="alert"` ("Revisá las fechas: …") con el formulario precargado con lo pedido y un link "Limpiar", como el 400 del Inicio.
  - Poné el parseo en un helper puro, `leerFiltrosVencimientos(searchParams)` en `src/lib/vencimientos.ts`, con tests. Usá lo que la etapa 0 dejó en `lib/paginacion.ts` (parseo de `pagina`, `calcularPaginacion`, `esUuid`). `urlVencimientos(filtros)` arma la URL omitiendo los defaults (la usan las pestañas, la paginación, las tarjetas del Inicio y el detalle del cliente).
- **Datos para los filtros:** `GET /impuestos` y la lista de clientes para el `<select>`. Pedilos en paralelo con el listado y con `GET /estadisticas` (`Promise.all`). En la pestaña Próximos no hacen falta (no hay formulario de filtros).
  - Clientes: `GET /clientes` con `limit=100` (el máximo de la API) **y todos los estados**, porque el listado de vencimientos incluye clientes dados de baja. Si `total > 100`, pedí las páginas que falten. Poné esto en un helper `server-only` en `lib/api/` (por ejemplo `todosLosClientes()`), envuelto en `cache()` de React.
  - En el `<select>`, los clientes dados de baja llevan "(dado de baja)" al lado del nombre.
- **Formulario de filtros:** mismo patrón que `components/clientes/filtros-clientes.tsx` (GET nativo sin JS; con JS, `router.push` dentro de `useTransition` y el botón dice "Buscando…"). El estado **no** va en el formulario (lo elige la pestaña): va como `<input type="hidden" name="estado">` si no es el default, así aplicar filtros no cambia de pestaña. `<select>` nativos para cliente e impuesto (opción vacía "Todos"); `<input type="date">` para desde y hasta. En la pestaña Próximos, en vez del formulario, una línea: "Próximos 30 días de clientes activos. Para filtrar por cliente, impuesto o fechas, usá otra pestaña." Sin `pagina`, así que cambiar un filtro vuelve a la página 1. Link "Limpiar" a la pestaña actual sin filtros. `key` armado con los filtros.
- **Tabla** (desde `md`): Vencimiento (fecha `dd/mm/aaaa`, link al detalle), Cliente (razón social), Impuesto (nombre), Período (`octubre 2026` para `YYYY-MM` con `formatearMes`; el año tal cual para `YYYY`), Estado (badge con el texto y un cuadradito del color del estado, ver abajo) y Presentado el (`fechaPresentacion` o "—").
- **En el celular:** una tarjeta por vencimiento con los mismos datos, sin scroll horizontal.
- **Estado:** `ESTADO_VENCIMIENTO` en `lib/vencimientos.ts` con etiqueta y clase de color por `estadoActual`: Pendiente (`bg-estado-pendiente`), Vencido (`bg-estado-vencido`), Presentado (`bg-estado-presentado`), los mismos tokens del Inicio. El color nunca es la única pista: siempre va el texto. "Vencido" se destaca (texto en `destructive`).
- **Paginación:** igual que en clientes ("Página X de Y · N vencimientos", "Anterior" y "Siguiente" que conservan los filtros; deshabilitados sin `href` en los extremos).
- **Vacíos:** si el estudio no tiene ningún vencimiento (los cuatro conteos de `/estadisticas` en 0) → "Todavía no cargaste vencimientos" + "Nuevo vencimiento", en cualquier pestaña. Si no, una pestaña vacía sin otros filtros → un texto propio ("No hay vencidos", "No hay pendientes al día", "No hay vencimientos en los próximos 30 días", "Todavía no hay presentados"); con filtros → "No hay vencimientos con estos filtros" + "Limpiar filtros". Una `pagina` mayor que la última → "No hay vencimientos en esta página" + "Ir a la página 1".
- Arriba a la derecha, el botón **"Nuevo vencimiento"** (a `/vencimientos/nuevo`, o a `/vencimientos/nuevo?cliente=<id>` si hay un filtro de cliente).
- **Aviso de borrado:** con `?ok=borrado`, un `role="status"` "Vencimiento borrado" con un link "Cerrar" (a la misma URL sin `ok`).

## C. Alta, detalle y acciones

**Helpers puros** (sin `server-only`, con tests):
- **`src/lib/fechas.ts`:**
  - `fechaValida(s)`: `YYYY-MM-DD` y que el día exista (bisiestos incluidos), sin `new Date()`.
  - `hoyArgentina()`: la fecha de hoy en `America/Argentina/Buenos_Aires` como `YYYY-MM-DD`, con `Intl.DateTimeFormat('en-CA', { timeZone, … })`. (La regla de CLAUDE.md prohíbe parsear las fechas de la API con `new Date()`; acá se toma el instante actual y se formatea en la zona correcta, que es lo mismo que hace la API.) Se usa para el `max` del input de fecha de presentación y para validar que no sea futura. Testealo con `vi.setSystemTime` en un borde: `2026-11-21T02:00:00Z` es `2026-11-20` en Argentina.
- **`src/lib/vencimientos.ts`:**
  - Filtros, URL del listado y `ESTADO_VENCIMIENTO` (sección B).
  - `formatearPeriodo(periodo)`: `2026-10` → `octubre 2026`; `2025` → `2025`.
  - `validarVencimiento(datos, impuestos)`, con errores por campo en español:
    - "Elegí un cliente"
    - "Elegí un impuesto"
    - "Ingresá una fecha válida"
    - Período: "Ingresá el período" si está vacío; si el formato no coincide con la periodicidad del impuesto elegido, "Para {impuesto} el período es AAAA-MM (por ejemplo, 2026-10)" o "Para {impuesto} el período es AAAA (por ejemplo, 2025)".
    - "Las notas pueden tener hasta 2000 caracteres"
  - `validarPresentacion(fecha, hoy)`: vacía es válida (la API usa hoy); si no, "Ingresá una fecha válida" o "La fecha de presentación no puede ser futura".
  - `validarNotas(notas)`.

**Server Actions** en `src/app/(panel)/vencimientos/actions.ts` (`'use server'`), con el mismo patrón que `clientes/actions.ts` y los helpers de `lib/acciones.ts` (etapa 0):
- `crearVencimiento(estadoPrevio, formData)`: `GET /impuestos` para validar el período contra la periodicidad, después `POST /vencimientos`.
- `marcarPresentado(id, estadoPrevio, formData)`: `PATCH { estado: 'presentado', fechaPresentacion? }` (si la fecha viene vacía, no se manda).
- `volverAPendiente(id)`: `PATCH { estado: 'pendiente' }`.
- `guardarNotas(id, estadoPrevio, formData)`: `PATCH { notas }` (vacía → `null`).
- `borrarVencimiento(id)`: `DELETE`.
- **Errores:**
  - 409 → mensaje de la API en el campo cuando corresponde: duplicado → `periodo`; "El cliente está dado de baja" → `clienteId`.
  - 404 **en el alta** (cliente o impuesto que ya no existe) → el mensaje de la API en el campo correspondiente (`clienteId` o `impuestoId`). 404 en `PATCH` o `DELETE` → `notFound()`.
  - 400 → "Revisá los datos". El resto → "No se pudo conectar con el servidor".
  - Todo retorno con error pasa por `fallo()` (con `refresh()`; ver CLAUDE.md).
- **Al terminar bien:** `revalidatePath('/', 'layout')` y `redirect()` fuera del `try`:
  - alta → `/vencimientos/[id]?ok=creado` ("Vencimiento creado");
  - presentado → `?ok=presentado` ("Marcado como presentado");
  - pendiente → `?ok=pendiente` ("Volvió a pendiente");
  - notas → `?ok=notas` ("Notas guardadas");
  - borrado → `/vencimientos?ok=borrado` ("Vencimiento borrado").

**Formulario de alta** (`components/vencimientos/formulario-vencimiento.tsx`, cliente, `useActionState`):
- **Campos:** Cliente (`<select>` nativo, **solo clientes activos**: la API rechaza los dados de baja; si viene `?cliente=<id>` y está activo, preseleccionado), Impuesto (`<select>` nativo con la periodicidad en el texto), Fecha de vencimiento (`<input type="date">`), Período (texto, con la ayuda de la decisión 4) y Notas (opcional, `<textarea>`, `maxLength` 2000).
- Errores debajo de cada campo con `aria-invalid` y `aria-describedby`, usando `Campo`, `ariaCampo`, `MensajeError` y `claseSelect` de `components/formularios/campo.tsx` (etapa 0).
- **Ayuda del período:** el texto de la decisión 4, en un `<p id="periodo-ayuda">` referenciado por `aria-describedby` (junto con el error, si hay). Con JS, un `onChange` en el `<select>` de impuesto cambia la ayuda y el `placeholder` según la periodicidad (el formulario recibe los impuestos con su periodicidad como prop). Sin JS queda la ayuda general. La validación del front (`validarVencimiento`) corre en la action; la API valida de nuevo.
- Botón "Guardar" → "Guardando…" (el `pending` de `useActionState`). Link "Cancelar" (al listado, o al detalle del cliente si vino de ahí).
- Devolvé `valores` y usá el `key` con los valores, como en `FormularioCliente`.
- Si el estudio no tiene clientes activos, en vez del formulario: "Para cargar un vencimiento necesitás un cliente activo" con un link a "Nuevo cliente".

**Páginas** (todas con `instant = false`):
- **`/vencimientos/nuevo`:** el formulario. Carga clientes (activos) e impuestos en paralelo.
- **`/vencimientos/[id]`:** detalle.
  - Encabezado: impuesto y período ("IVA · octubre 2026") como `<h1>`, y el badge del estado.
  - Datos: cliente (link a `/clientes/[clienteId]`, con el CUIT formateado), impuesto, período, fecha de vencimiento, estado, fecha de presentación (o "—") y notas (o "Sin notas").
  - Aviso `?ok=` en un `role="status"` con "Cerrar", como en clientes.
  - **Estado:**
    - Si está pendiente o vencido: un form "Marcar como presentado", con "Fecha de presentación" (`<input type="date">` opcional, `max` = hoy en Argentina, ayuda "Si la dejás vacía, se usa la fecha de hoy") y el botón "Marcar como presentado" → "Guardando…".
    - Si está presentado: "Presentado el {fecha}" y un botón "Volver a pendiente" (form con `volverAPendiente`, con `FormularioAccion`).
  - **Notas:** un form con un `<textarea>` precargado y "Guardar notas" → "Guardando…". Vaciarlo y guardar las borra.
  - **Borrar:** link "Borrar" a `?confirmar=borrar`; con ese parámetro, un recuadro "¿Borrar el vencimiento de {impuesto} {período} de {razón social}? No se puede deshacer." con un form "Sí, borrar" (`borrarVencimiento`) y "Cancelar". Igual que la baja de clientes.
- **No encontrado:** `obtenerVencimiento(id)` en `lib/api/vencimientos.ts` (`server-only`), como `obtenerCliente`: `notFound()` si el id no es UUID o si la API da 404/400. `src/app/(panel)/vencimientos/[id]/not-found.tsx` con "Vencimiento no encontrado" y un link al listado.
- **shadcn:** no hace falta agregar componentes (`table`, `badge`, `card`, `input`, `label` ya están). Si agregás alguno, revisá después que no cambien versiones en `package.json`. No agregues `select`, `alert-dialog` ni `textarea` de shadcn si no funcionan sin JS; un `<textarea>` nativo con las clases del `Input` alcanza.

## D. Tests

### Unitarios (Vitest, `src/**/*.test.ts`)

- **`lib/fechas.test.ts`** (ampliar): `fechaValida` (formato, 31 de abril, 29 de febrero en bisiesto y no bisiesto) y `hoyArgentina` en el borde de medianoche.
- **`lib/vencimientos.test.ts`:** `leerFiltrosVencimientos` (default `pendiente`, `proximos`, inválidos, repetidos, UUID inválidos ignorados, fechas inválidas y `desde > hasta`), la traducción a la query de la API (incluido que `proximos` va a `/vencimientos/proximos` solo con `page`/`limit`), las URLs (conservan los filtros, omiten los defaults, el link a Próximos no conserva cliente/impuesto/fechas), las cantidades de las pestañas a partir de `vencimientos` de `/estadisticas` ("Todos" = suma; sin número cuando hay otros filtros), `formatearPeriodo`, `validarVencimiento` (período mensual y anual contra la periodicidad, cada mensaje), `validarPresentacion` y `validarNotas`.
- Los tests de lo que movió la etapa 0 siguen verificando lo mismo que antes.

### E2E (Playwright)

**Infraestructura:**
- Agregá a `e2e/fixtures.ts`: `crearVencimientoApi(token, datos)`, `impuestosApi(token)` (o un helper para buscar un impuesto por `codigo`), y lo que haga falta para preparar datos desde Node. Reusá `api()`, `crearClienteApi()` y `sufijoUnico()`.
- **No se suman logins** (siguen siendo 7). Los tests que solo leen usan `RUTA_SESION_ADMIN`; los que crean, modifican o borran usan `RUTA_SESION_PROPIA` y crean **sus propios clientes y vencimientos**. Para no chocar con el índice único `(cliente, impuesto, periodo)`, cada test crea su propio cliente.
- Recordá que Next conserva las rutas ya visitadas ocultas en el DOM: `exact: true`, `getByRole` o `.filter({ visible: true })`.

**Con el admin de demo (solo leen)**, en `e2e/vencimientos-lectura.spec.ts`:
1. **Navegación:** "Vencimientos" es un link y queda activo en `/vencimientos` y en `/vencimientos/<id>`. Actualizá el test 1 de `clientes-lectura.spec.ts`, que hoy verifica que "Vencimientos" no es un link.
2. **Listado por defecto:** la pestaña activa es "Pendientes" y coincide con `GET /vencimientos?estado=pendiente` pedido desde Node: misma cantidad en la página 1, mismo orden (por fecha), fechas `dd/mm/aaaa` y "Pendiente" en cada fila.
3. **Pestañas:** los números de las cinco pestañas coinciden con `GET /estadisticas` pedido desde Node ("Todos" = suma). "Vencidos" (seed:demo siempre tiene): todas las filas dicen "Vencido" y coinciden con la API. "Próximos 30 días" coincide con `GET /vencimientos/proximos` y no muestra los filtros de cliente/impuesto/fechas. Con un filtro de cliente, las pestañas van sin número y conservan el filtro (salvo Próximos).
4. **Filtro por cliente y por impuesto:** la URL refleja `cliente`/`impuesto` y las filas coinciden con la API.
5. **Rango:** `desde`/`hasta` válidos filtran como la API. `desde > hasta` muestra el aviso sin llamar a la API y "Limpiar" vuelve al listado.
6. **Detalle:** un vencimiento de la API muestra cliente, impuesto, período formateado y estado. `/vencimientos/<uuid aleatorio>` y `/vencimientos/no-es-uuid` muestran "Vencimiento no encontrado".
7. **Celular (390 px):** tarjetas, sin scroll horizontal.
8. **Tarjetas del Inicio:** cada una de las cinco lleva a su destino (decisión 2), y al hacer click en "Próximos 30 días" la pestaña activa es esa y el total del listado ("N vencimientos") es el número de la tarjeta. Lo mismo con "Vencidos".

**Con el admin propio (modifican datos)**, en `e2e/vencimientos-edicion.spec.ts`:
1. **Alta:** con un cliente creado por la API, elegir cliente, IVA, fecha y período `AAAA-MM` → detalle con "Vencimiento creado" y estado "Pendiente"; aparece en el listado filtrado por ese cliente.
2. **Validación del período:** Ganancias con `2026-10` muestra "Para Ganancias el período es AAAA (por ejemplo, 2025)" sin llamar a la API (el vencimiento no existe en la API), y los valores se conservan. Al elegir Ganancias, la ayuda cambia a "Formato AAAA, por ejemplo 2025"; al elegir IVA, a "Formato AAAA-MM, por ejemplo 2026-10".
3. **Duplicado:** repetir cliente + impuesto + período de uno creado por la API muestra el 409 en el campo período.
4. **Cliente dado de baja:** no aparece en el `<select>` del alta (crear uno, darlo de baja por la API y verificarlo).
5. **Alta sin JS** (`javaScriptEnabled: false`): llega al detalle, y la ayuda del período es la general. Solo el caso exitoso (los errores sin JS no se ven en producción: "Errores de formularios sin JS (aceptado)" en CLAUDE.md).
6. **Vencido:** uno creado por la API con fecha pasada muestra "Vencido" en el listado y en el detalle.
7. **Marcar como presentado** con una fecha pasada → "Marcado como presentado", estado "Presentado" y "Presentado el {fecha}". Una fecha futura muestra "La fecha de presentación no puede ser futura" sin llamar a la API. **Volver a pendiente** → "Volvió a pendiente" y la fecha de presentación desaparece.
8. **Notas:** guardar un texto → "Notas guardadas" y se ve; vaciarlo y guardar → "Sin notas". Verificá contra la API.
9. **Borrar con confirmación:** "Cancelar" no cambia nada; "Sí, borrar" lleva a `/vencimientos?ok=borrado` con "Vencimiento borrado", y el detalle pasa a "Vencimiento no encontrado".
10. **Paginación:** 21 vencimientos por la API para un cliente propio (mismo impuesto mensual, 21 períodos distintos) y filtrar por ese cliente: "Página 1 de 2 · 21 vencimientos", "Siguiente" conserva el filtro y muestra 1.
11. **Desde el cliente:** en el detalle de un cliente activo, "Nuevo vencimiento" abre el alta con el cliente ya elegido y "Ver vencimientos" abre la pestaña Todos filtrada por ese cliente. Un cliente dado de baja muestra "Ver vencimientos" pero no "Nuevo vencimiento".

**El fixture automático** sigue verificando que el navegador nunca llame a la API (`:3000`). No lo desactives.

## E. Documentación

- **CLAUDE.md:**
  - Agregá "Decisiones de implementación (paso 4: Vencimientos)": las decisiones confirmadas con el usuario, los parámetros de URL, la validación de fechas en el front, `hoyArgentina()`, el período contra la periodicidad, el detalle (estado, notas, borrado por URL), los avisos `?ok=`, el manejo de errores (incluido el 404 del alta) y lo que se haya movido a módulos comunes.
  - Actualizá la sección Tests: los specs nuevos, los helpers de `fixtures.ts` y los unitarios.
  - Si `test:e2e:prod` tiene fallos nuevos, explicalos en "Pendiente para el deploy" (sin arreglar lo que ya está anotado ahí, salvo que el usuario lo pida).
  - Marcá el paso 4 como hecho en "Orden de trabajo".
- No toques el README; es del paso 5.

## Verificación final

En Windows, corré todo desde PowerShell con `Set-Location 'C:\Users\Edgardo\workspace\claudecode\contable-dashboard'`, con la unidad en **mayúscula** (con `c:\`, Vitest falla en todas las suites).

1. `npx tsc --noEmit`
2. `npm run lint`
3. `npm test`
4. `npm run build`
5. `npm run test:e2e`, dos veces seguidas, para confirmar que no dependen de datos que dejó la corrida anterior.
6. `npm run test:e2e:prod` (con `next dev` apagado). Hoy hay 1 fallo conocido (el 404 de `clientes-lectura`); reportá cualquier otro.
7. Revisá en `next dev` que no aparezca "Next.js encountered uncached data" al navegar las páginas nuevas.
8. Revisá visualmente el listado, el alta y el detalle en tema claro y oscuro (con `colorScheme` de Playwright) y a 390 px.

Al terminar, armá un resumen con las decisiones que tomaste por tu cuenta, lo que quedó pendiente y el resultado de cada verificación. **Sin commits.**
