# Plan del paso 4: Vencimientos

Está escrito para que una sesión nueva lo ejecute sin el historial de la conversación en que se armó. **Antes de escribir código, confirmá con el usuario las decisiones de la sección "Decisiones a confirmar"** (salvo que el usuario ya las haya marcado como aprobadas en este archivo).

## Antes de empezar

1. Leé `CLAUDE.md` (raíz del repo; está en `.gitignore`, así que existe solo en la copia local) y `AGENTS.md`. Tienen las reglas del proyecto y las decisiones de los pasos 1 a 3. Este plan no las repite. Prestá atención a:
   - **Git:** no corras comandos que modifiquen el repo o el árbol de trabajo (`stash`, `checkout`, `reset`, `restore`, `commit`, …) sin preguntar. Solo lectura está bien. **Sin commits.**
   - "Decisiones de implementación (paso 3: Clientes)": el patrón de Server Actions (`fallo()` con `refresh()`, `revalidatePath('/', 'layout')` + `redirect()` fuera del `try`, avisos `?ok=`, confirmación por URL, `<select>` nativo, errores por idioma) y la nota sobre rutas ocultas en el DOM en los e2e.
   - "Pendiente para el deploy": en producción, los errores de Server Actions **sin JS** no se ven, y `notFound()` y el redirect de un 401 responden 200.
2. Leé el `CLAUDE.md` de la API (`../contable-api/CLAUDE.md`): la entidad Vencimiento, "Vencimientos" e "Impuestos" en endpoints, y "Decisiones de implementación (vencimientos)".
3. Verificá que el árbol esté limpio (`git status`) y que la API esté arriba en `E2E_API_URL` con `seed:demo` cargado y `LOGIN_RATE_LIMIT` alto (p. ej. 100) en su `.env`.
4. Corré la verificación completa antes de tocar nada (ver "Verificación final"), para tener una base verde. `test:e2e:prod` hoy tiene 2 fallos conocidos (ver CLAUDE.md).
5. Si hay dudas sobre APIs de Next, leé `node_modules/next/dist/docs/`. Next es 16.4.6, con Cache Components.

## Decisiones a confirmar (preguntarle al usuario antes de empezar)

Cada una tiene una recomendación. Si el usuario no dice otra cosa, se usa la recomendada.

1. **Filtro por defecto del listado.** La API ordena siempre por `fechaVencimiento` ascendente y filtra por un solo estado, así que no se puede pedir "pendientes + vencidos" en una llamada.
   - **Recomendado: "Todos"**, y que las tarjetas del Inicio sean links al listado filtrado (punto 2). Es lo más simple y coincide con la API. Contra: la página 1 muestra lo más viejo (seed:demo tiene vencimientos de hace 5 meses).
   - Alternativa: "Vencidos" por defecto (lo más urgente). Contra: con 0 vencidos, el listado arranca vacío.
2. **Tarjetas del Inicio como links.** "Pendientes (al día)" → `/vencimientos?estado=pendiente`, "Vencidos" → `?estado=vencido`, "Presentados" → `?estado=presentado`. "Clientes activos" → `/clientes`. "Próximos 30 días" **sin** link: `/vencimientos/proximos` excluye clientes dados de baja y el listado no, así que un filtro por fechas no daría el mismo número. **Recomendado: sí.**
3. **Vencimientos desde el cliente.** En el detalle del cliente, links "Ver vencimientos" (`/vencimientos?cliente=<id>`) y, si está activo, "Nuevo vencimiento" (`/vencimientos/nuevo?cliente=<id>`, con el cliente preseleccionado). **Recomendado: sí.** No se agrega un listado de vencimientos dentro del detalle del cliente.
4. **Período en el alta.** Sin JS no se puede cambiar el tipo de input según el impuesto elegido. **Recomendado:** un input de texto "Período", con la ayuda "AAAA-MM para impuestos mensuales, AAAA para anuales". La action valida el formato contra la periodicidad del impuesto elegido (sale de `GET /impuestos`). El `<select>` de impuestos muestra la periodicidad: "IVA (mensual)", "Ganancias (anual)".
5. **Helpers compartidos de las Server Actions.** `fallo()`, `estadoDeError()` y el armado del redirect con aviso están hoy dentro de `(panel)/clientes/actions.ts`, y un archivo `'use server'` solo puede exportar funciones async. **Recomendado:** moverlos a `src/lib/api/acciones.ts` (`server-only`) y reusarlos desde las dos carpetas de actions, sin cambiar su comportamiento. Los tests de clientes tienen que seguir en verde.

## Hechos de la API (verificados en `../contable-api` y en `src/lib/api/schema.d.ts`)

Todo se filtra por el `adminId` del token. Un vencimiento de otro estudio o inexistente da 404, y un `:id` que no es UUID da 400.

| Endpoint | Notas |
|---|---|
| `GET /vencimientos?page&limit&estado&clienteId&impuestoId&desde&hasta` | `estado` filtra por **estado actual**: `pendiente` (no vencido), `vencido` o `presentado`; sin él vienen todos. `desde`/`hasta` filtran `fechaVencimiento`, inclusive (`YYYY-MM-DD`, la fecha tiene que existir). `desde > hasta` da 400 "desde no puede ser posterior a hasta". Ordena por `fechaVencimiento` ascendente, después por `id`. Incluye clientes dados de baja. Responde `{ data, total, page, limit }`. |
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

## A. Navegación e Inicio

- En `components/panel/nav-links.tsx`, "Vencimientos" pasa a ser un link a `/vencimientos`, activo también en sus subrutas. Se va el `<span aria-disabled>` con "Próximamente".
- Si se aprueba la decisión 2: las tarjetas del Inicio (`(panel)/page.tsx`) llevan un link. Que toda la tarjeta sea clickeable, con un `<Link>` que tenga un nombre accesible claro (por ejemplo "Ver vencidos"), y foco visible. Los e2e del Inicio buscan las tarjetas por `data-testid`: no lo cambies.
- Si se aprueba la decisión 3: en `(panel)/clientes/[id]/page.tsx`, los links "Ver vencimientos" y "Nuevo vencimiento" (este solo si el cliente está activo).

## B. Listado `/vencimientos`

- **Archivo:** `src/app/(panel)/vencimientos/page.tsx`, con `export const instant = false` (`instant.test.ts` ya recorre `(panel)`).
- **Parámetros de la URL** (en español): `estado` (`todos` \| `pendiente` \| `vencido` \| `presentado`; el default sale de la decisión 1), `cliente` (UUID), `impuesto` (UUID), `desde`, `hasta` (`YYYY-MM-DD`) y `pagina` (entero ≥ 1).
  - Se traducen a la API: `estado` (ausente si es `todos`), `clienteId`, `impuestoId`, `desde`, `hasta`, `page` y `limit` = `POR_PAGINA = 20`.
  - Un `cliente` o `impuesto` que no es UUID se ignora (si no, la API da 400). Un `estado` inválido vale el default; una `pagina` inválida vale 1.
  - **Fechas:** validá en el front que sean `YYYY-MM-DD` y que existan (sin `new Date()`: con regex y días por mes, en `lib/fechas.ts`), y que `desde ≤ hasta` (comparando los strings). Si algo falla, **no llames a la API**: mostrá un `role="alert"` ("Revisá las fechas: …") con el formulario precargado con lo pedido y un link "Limpiar", como el 400 del Inicio.
  - Poné el parseo en un helper puro, `leerFiltrosVencimientos(searchParams)` en `src/lib/vencimientos.ts`, con tests. Reusá lo que se pueda de `lib/clientes.ts` (por ejemplo, el parseo de `pagina`, `calcularPaginacion` y `esUuid`). Si conviene, mové lo genérico a un módulo común (por ejemplo `lib/paginacion.ts`) sin cambiar el comportamiento de clientes.
- **Datos para los filtros:** `GET /impuestos` y la lista de clientes para el `<select>`. Pedilos en paralelo con el listado (`Promise.all`).
  - Clientes: `GET /clientes` con `limit=100` (el máximo de la API) **y todos los estados**, porque el listado de vencimientos incluye clientes dados de baja. Si `total > 100`, pedí las páginas que falten. Poné esto en un helper `server-only` en `lib/api/` (por ejemplo `todosLosClientes()`), envuelto en `cache()` de React.
  - En el `<select>`, los clientes dados de baja llevan "(dado de baja)" al lado del nombre.
- **Formulario de filtros:** mismo patrón que `components/clientes/filtros-clientes.tsx` (GET nativo sin JS; con JS, `router.push` dentro de `useTransition` y el botón dice "Buscando…"). `<select>` nativos para estado, cliente e impuesto (opción vacía "Todos"); `<input type="date">` para desde y hasta. Sin `pagina`, así que cambiar un filtro vuelve a la página 1. Link "Limpiar" a `/vencimientos`. `key` armado con los filtros.
- **Tabla** (desde `md`): Vencimiento (fecha `dd/mm/aaaa`, link al detalle), Cliente (razón social), Impuesto (nombre), Período (`octubre 2026` para `YYYY-MM` con `formatearMes`; el año tal cual para `YYYY`), Estado (badge con el texto y un cuadradito del color del estado, ver abajo) y Presentado el (`fechaPresentacion` o "—").
- **En el celular:** una tarjeta por vencimiento con los mismos datos, sin scroll horizontal.
- **Estado:** `ESTADO_VENCIMIENTO` en `lib/vencimientos.ts` con etiqueta y clase de color por `estadoActual`: Pendiente (`bg-estado-pendiente`), Vencido (`bg-estado-vencido`), Presentado (`bg-estado-presentado`), los mismos tokens del Inicio. El color nunca es la única pista: siempre va el texto. "Vencido" se destaca (texto en `destructive`).
- **Paginación:** igual que en clientes ("Página X de Y · N vencimientos", "Anterior" y "Siguiente" que conservan los filtros; deshabilitados sin `href` en los extremos).
- **Vacíos:** sin resultados → "No hay vencimientos con estos filtros" + "Limpiar filtros". Si el estudio no tiene ningún vencimiento (sin filtros y `total` 0; si el estado por defecto no es "todos", hace falta una llamada extra como en clientes) → "Todavía no cargaste vencimientos" + "Nuevo vencimiento". Una `pagina` mayor que la última → "No hay vencimientos en esta página" + "Ir a la página 1".
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

**Server Actions** en `src/app/(panel)/vencimientos/actions.ts` (`'use server'`), con el mismo patrón que `clientes/actions.ts` (ver la decisión 5):
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
- Errores debajo de cada campo con `aria-invalid` y `aria-describedby`, usando `Campo`, `ariaCampo`, `MensajeError` y `claseSelect` de `components/clientes/campo.tsx`. Si los vas a usar desde las dos pantallas, mové ese archivo a un lugar común (por ejemplo `components/formularios/campo.tsx`) y actualizá los imports de clientes.
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
- **`lib/vencimientos.test.ts`:** `leerFiltrosVencimientos` (defaults, inválidos, repetidos, UUID inválidos ignorados, fechas inválidas y `desde > hasta`), la traducción a la query de la API, las URLs (conservan los filtros y omiten los defaults), `formatearPeriodo`, `validarVencimiento` (período mensual y anual contra la periodicidad, cada mensaje), `validarPresentacion` y `validarNotas`.
- Si moviste helpers de `lib/clientes.ts`, sus tests tienen que seguir pasando sin cambios en lo que verifican.

### E2E (Playwright)

**Infraestructura:**
- Agregá a `e2e/fixtures.ts`: `crearVencimientoApi(token, datos)`, `impuestosApi(token)` (o un helper para buscar un impuesto por `codigo`), y lo que haga falta para preparar datos desde Node. Reusá `api()`, `crearClienteApi()` y `sufijoUnico()`.
- **No se suman logins** (siguen siendo 7). Los tests que solo leen usan `RUTA_SESION_ADMIN`; los que crean, modifican o borran usan `RUTA_SESION_PROPIA` y crean **sus propios clientes y vencimientos**. Para no chocar con el índice único `(cliente, impuesto, periodo)`, cada test crea su propio cliente.
- Recordá que Next conserva las rutas ya visitadas ocultas en el DOM: `exact: true`, `getByRole` o `.filter({ visible: true })`.

**Con el admin de demo (solo leen)**, en `e2e/vencimientos-lectura.spec.ts`:
1. **Navegación:** "Vencimientos" es un link y queda activo en `/vencimientos` y en `/vencimientos/<id>`. Actualizá el test 1 de `clientes-lectura.spec.ts`, que hoy verifica que "Vencimientos" no es un link.
2. **Listado por defecto:** coincide con `GET /vencimientos` (con el filtro por defecto) pedido desde Node: misma cantidad en la página 1, mismo orden, fechas `dd/mm/aaaa` y el `estadoActual` como texto.
3. **Filtro por estado "Vencidos"** (si seed:demo tiene alguno, que tiene): todas las filas dicen "Vencido" y coinciden con la API.
4. **Filtro por cliente y por impuesto:** la URL refleja `cliente`/`impuesto` y las filas coinciden con la API.
5. **Rango:** `desde`/`hasta` válidos filtran como la API. `desde > hasta` muestra el aviso sin llamar a la API y "Limpiar" vuelve al listado.
6. **Detalle:** un vencimiento de la API muestra cliente, impuesto, período formateado y estado. `/vencimientos/<uuid aleatorio>` y `/vencimientos/no-es-uuid` muestran "Vencimiento no encontrado".
7. **Celular (390 px):** tarjetas, sin scroll horizontal.
8. Si se aprueba la decisión 2: en el Inicio, la tarjeta "Vencidos" lleva a `/vencimientos?estado=vencido`.

**Con el admin propio (modifican datos)**, en `e2e/vencimientos-edicion.spec.ts`:
1. **Alta:** con un cliente creado por la API, elegir cliente, IVA, fecha y período `AAAA-MM` → detalle con "Vencimiento creado" y estado "Pendiente"; aparece en el listado filtrado por ese cliente.
2. **Validación del período:** Ganancias con `2026-10` muestra "Para Ganancias el período es AAAA (por ejemplo, 2025)" sin llamar a la API (el vencimiento no existe en la API), y los valores se conservan.
3. **Duplicado:** repetir cliente + impuesto + período de uno creado por la API muestra el 409 en el campo período.
4. **Cliente dado de baja:** no aparece en el `<select>` del alta (crear uno, darlo de baja por la API y verificarlo).
5. **Alta sin JS** (`javaScriptEnabled: false`): llega al detalle. Solo el caso exitoso (los errores sin JS no se ven en producción, ver CLAUDE.md).
6. **Vencido:** uno creado por la API con fecha pasada muestra "Vencido" en el listado y en el detalle.
7. **Marcar como presentado** con una fecha pasada → "Marcado como presentado", estado "Presentado" y "Presentado el {fecha}". Una fecha futura muestra "La fecha de presentación no puede ser futura" sin llamar a la API. **Volver a pendiente** → "Volvió a pendiente" y la fecha de presentación desaparece.
8. **Notas:** guardar un texto → "Notas guardadas" y se ve; vaciarlo y guardar → "Sin notas". Verificá contra la API.
9. **Borrar con confirmación:** "Cancelar" no cambia nada; "Sí, borrar" lleva a `/vencimientos?ok=borrado` con "Vencimiento borrado", y el detalle pasa a "Vencimiento no encontrado".
10. **Paginación:** 21 vencimientos por la API para un cliente propio (mismo impuesto mensual, 21 períodos distintos) y filtrar por ese cliente: "Página 1 de 2 · 21 vencimientos", "Siguiente" conserva el filtro y muestra 1.
11. Si se aprueba la decisión 3: desde el detalle de un cliente, "Nuevo vencimiento" abre el alta con el cliente preseleccionado y "Ver vencimientos" filtra el listado.

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
6. `npm run test:e2e:prod` (con `next dev` apagado). Hoy hay 2 fallos conocidos; reportá cualquier otro.
7. Revisá en `next dev` que no aparezca "Next.js encountered uncached data" al navegar las páginas nuevas.
8. Revisá visualmente el listado, el alta y el detalle en tema claro y oscuro (con `colorScheme` de Playwright) y a 390 px.

Al terminar, armá un resumen con las decisiones que tomaste por tu cuenta, lo que quedó pendiente y el resultado de cada verificación. **Sin commits.**
