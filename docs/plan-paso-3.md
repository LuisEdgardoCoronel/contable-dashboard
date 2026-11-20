# Plan del paso 3: Clientes

Plan aprobado. Está escrito para que una sesión nueva lo ejecute sin el historial de la conversación en que se armó.

## Antes de empezar

1. Leé `CLAUDE.md` (raíz del repo; está en `.gitignore`, así que existe solo en la copia local) y `AGENTS.md`. Tienen las reglas del proyecto y las decisiones de los pasos 1 y 2. Este plan no las repite.
2. Leé el `CLAUDE.md` de la API (`../contable-api/CLAUDE.md`), sobre todo "Clientes" en endpoints y "Decisiones de implementación (clientes)".
3. Verificá que el árbol esté limpio (`git status`) y que la API esté arriba en `E2E_API_URL` con `seed:demo` cargado y `LOGIN_RATE_LIMIT` alto (p. ej. 100) en su `.env`.
4. Corré la verificación completa antes de tocar nada, para tener una base verde (ver "Verificación final").
5. Si hay dudas sobre APIs de Next (Server Actions, `redirect`, `useActionState`, revalidación), leé `node_modules/next/dist/docs/` antes de escribir código. Next es 16.4.6, con Cache Components.
6. **Sin commits.** El usuario commitea.

## Decisiones ya tomadas (no reabrir)

- **Alta y edición en páginas propias** (`/clientes/nuevo` y `/clientes/[id]/editar`), no en diálogos. Funcionan sin JS y tienen URL.
- **Filtro por defecto del listado: "Activos".**
- **Los tests e2e que crean, editan o dan de baja clientes usan un admin propio**, registrado en la misma corrida. No usan el admin de demo, para no ensuciar sus datos. Los tests que solo leen pueden usar el admin de demo. **No depender de que `seed:demo` limpie nada.**
- **Agregar a "Pendiente para el deploy"** del CLAUDE.md (si todavía no está): cada corrida e2e deja admins de prueba en la base y hace falta un script de limpieza en la API.

## Hechos de la API (verificados)

Todos los endpoints de clientes son solo para admin y se filtran por su `adminId`. Un cliente ajeno o inexistente da 404, y un `:id` que no es UUID da 400.

| Endpoint | Notas |
|---|---|
| `GET /clientes?page&limit&activo&search` | `activo` es un boolean opcional: sin él vienen todos. `search` busca en la razón social (sin distinguir mayúsculas) y, si el texto son solo dígitos o guiones, también en el CUIT. Ordena por razón social. Responde `{ data, total, page, limit }`. |
| `GET /clientes/:id` | Devuelve el detalle. |
| `POST /clientes` | Crea. Body: `razonSocial` (obligatorio, ≤255), `cuit` (11 dígitos con dígito verificador; acepta guiones y espacios), `email` (de contacto), `telefono` opcional (≤50; vacío → `null`) y `condicionIVA`. Un CUIT repetido en el estudio da **409 "Ya existe un cliente con ese CUIT"**. |
| `PUT /clientes/:id` | **Reemplaza** el cliente: lleva los mismos campos obligatorios que el alta, y un `telefono` omitido queda en `null`. Acepta un `activo` opcional: **es la única forma de reactivar** un cliente. |
| `DELETE /clientes/:id` | Baja lógica (`activo = false`). Responde 204 y es idempotente. El usuario cliente vinculado ya no puede loguearse. |
| `POST /clientes/:id/acceso` | Body: `email` (≤255), `password` (8–72) y `nombre` opcional (por defecto, la razón social). Responde 201. Da 409 con mensaje en español en tres casos: "El cliente ya tiene acceso", "El cliente está dado de baja" y "El email ya está registrado". |

- `condicionIVA` puede ser `responsable_inscripto`, `monotributista`, `exento`, `consumidor_final` o `no_alcanzado`.
- `ClienteResponseDto` trae `id`, `razonSocial`, `cuit`, `email`, `telefono` (o `null`), `condicionIVA`, `activo`, `adminId`, `usuarioId` (`null` si no tiene acceso) y `createdAt`. **No trae el email de login del cliente**: en el detalle solo se puede mostrar si tiene acceso o no.
- Los tipos ya existen en `src/lib/api/types.ts`: `Cliente`, `CondicionIVA`, `CrearClienteBody`, `ActualizarClienteBody`, `CrearAccesoBody`, `Usuario`, `ClientesQuery` y `Paginado<T>`.
- **Idioma de los errores:** los 404 y 409 de la API vienen en español. Los 400 de validación (class-validator) pueden venir en inglés (por ejemplo, "email must be an email"), salvo el del CUIT. Por eso: validar en el front antes de llamar a la API, mostrar el mensaje de la API **solo en los 409**, y convertir cualquier 400 en "Revisá los datos".
- **`seed:demo`** carga el admin `demo@example.com` / `demo1234` con 5 clientes, uno inactivo. Los datos dependen de la fecha de hoy. Los tests que leen los comparan contra la API, no contra números fijos.

## A. Barra de navegación (layout del panel)

En `src/app/(panel)/layout.tsx`, el header actual pasa a ser una barra de navegación:
- **A la izquierda:** "Contable" y los links **Inicio** (`/`) y **Clientes** (`/clientes`). El link activo lleva `aria-current="page"` y un estilo distinto; "Clientes" queda activo en `/clientes` y en todas sus subrutas. Para saber la ruta actual hace falta un componente cliente chico con `usePathname`, por ejemplo `components/panel/nav-links.tsx`.
- **Vencimientos:** se ve, pero sin link. Va como `<span aria-disabled="true">` con el texto "Próximamente" y estilo atenuado, hasta el paso 4.
- **A la derecha:** el saludo **"Hola, {nombre}"**, que se muda desde el Inicio, y el botón **"Cerrar sesión"** (el `<form method="post" action="/api/auth/logout">` que ya existe).
- En `src/app/(panel)/page.tsx`, el `<h1>` pasa a ser **"Inicio"**. Sacá el `getPerfil()` de la página si ya no se usa (el layout lo sigue llamando).
- **Responsive:** en el celular, los links bajan a una segunda fila, sin scroll horizontal.
- Usá `<nav aria-label="Principal">` dentro de `<header>`, para que los tests puedan usar `getByRole('navigation')` y `getByRole('banner')`.

**Tests a adaptar** (hoy buscan el heading "Hola, …"):
- `e2e/auth.spec.ts`: el test 3 (busca `Hola, ${E2E_ADMIN_NOMBRE}`) y los tests 5, 7 y 8 (`/^Hola, /`).
- `e2e/registro.spec.ts`: el registro exitoso, que busca `Hola, ${nombre}`.
- Buscá el saludo dentro de la barra: `page.getByRole('banner').getByText('Hola, …')`. No lo busques como heading.

## B. Listado `/clientes`

- **Archivos:** `src/app/(panel)/clientes/page.tsx` (Server Component, con `export const instant = false`; `src/app/instant.test.ts` ya recorre `(panel)`).
- **Parámetros de la URL** (en español): `buscar`, `estado` (`activos` | `baja` | `todos`; si falta o no es válido, vale `activos`) y `pagina` (entero ≥1; si no es válido, vale 1).
  - Se traducen a la API así: `search` = `buscar`, `activo` = `true` / `false` / ausente, `page` = `pagina` y `limit` = `POR_PAGINA = 20`.
  - Poné el parseo en un helper puro, `leerFiltrosClientes(searchParams)` en `src/lib/clientes.ts`, con tests, siguiendo el patrón de `leerRango` en `lib/estadisticas.ts`.
- **Formulario de filtros:** sigue el patrón de `components/inicio/formulario-rango.tsx`.
  - Es un `<form method="get" action="/clientes">` común. Con JS hace `router.push` dentro de `useTransition` y el botón dice "Buscando…" mientras carga; sin JS es un GET nativo.
  - Tiene un input de búsqueda (`buscar`), un **`<select>` nativo** para `estado` y un botón "Buscar". No uses el `Select` de shadcn: depende de JS, y el formulario tiene que funcionar sin él.
  - No incluye `pagina`, así que cambiar un filtro vuelve a la página 1.
  - Lleva un link "Limpiar" a `/clientes`, y un `key` armado con los filtros, para que los inputs no controlados se vuelvan a montar al cambiar la URL.
- **Tabla** (desde `md`): Razón social (link a `/clientes/[id]`), CUIT con formato `30-71234567-1`, Condición IVA en texto, Email, Estado (badge "Activo" o "Dado de baja") y Acceso ("Sí" o "No", según `usuarioId`).
- **En el celular:** una tarjeta por cliente con los mismos datos, sin scroll horizontal.
- **Paginación:** links "Anterior" y "Siguiente" que conservan los filtros, y el texto "Página X de Y · N clientes". Si es la primera o la última página, el link correspondiente se ve deshabilitado (sin `href`).
  - Poné el cálculo (`totalPaginas`, `hayAnterior` y `haySiguiente`) y el armado de la URL de cada página en `lib/clientes.ts`, con tests.
- **Vacío:** si no hay resultados, mostrá "No hay clientes con estos filtros" y un link "Limpiar filtros". Si el estudio no tiene ningún cliente (sin filtros y `total` en 0), mostrá "Todavía no cargaste clientes" con un link a "Nuevo cliente". Una `pagina` mayor que el total muestra el mensaje de vacío y un link a la página 1.
- Arriba a la derecha va el botón **"Nuevo cliente"**, que lleva a `/clientes/nuevo`.

## C. Alta, edición, detalle y acciones

**Helpers puros**, sin `server-only` y con tests:
- **`src/lib/cuit.ts`:**
  - `normalizarCuit` quita guiones y espacios.
  - `cuitValido` valida 11 dígitos y el dígito verificador módulo 11, con los multiplicadores `5,4,3,2,7,6,5,4,3,2`. Si el resto da 11, el dígito es 0; si da 10, el CUIT es inválido. Es la misma regla que el `IsCuit` de la API.
  - `formatearCuit` convierte `30712345671` en `30-71234567-1`.
- **`src/lib/clientes.ts`:**
  - `CONDICIONES_IVA`, con el valor y su texto: "Responsable inscripto", "Monotributista", "Exento", "Consumidor final" y "No alcanzado".
  - `validarCliente(datos)`, que devuelve errores por campo en español:
    - "Ingresá la razón social"
    - "El CUIT no es válido"
    - "Ingresá un email válido"
    - "El teléfono puede tener hasta 50 caracteres"
    - "Elegí una condición frente al IVA"
  - `validarAcceso(datos)`.
  - Los filtros y la paginación de B.

**Server Actions** en `src/app/(panel)/clientes/actions.ts` (`'use server'`):
- `crearCliente`, `actualizarCliente`, `darDeBaja`, `reactivarCliente` y `crearAcceso`.
- **Firma** para `useActionState`: `(estadoPrevio, formData)`. Devuelven `{ errores?: Record<campo, string>, mensaje?: string, valores?: … }`.
  - Devolvé `valores` para volver a llenar el formulario cuando hay errores: React 19 resetea el form después de la action.
- **Flujo:**
  1. Validan con los helpers de arriba.
  2. Llaman a `apiFetch`, que usa la cookie, y un 401 ya redirige.
  3. Si sale bien, hacen `redirect()` **fuera del `try/catch`**.
- **Errores:**
  - Un 409 muestra el mensaje de la API, asociado al campo cuando corresponde (CUIT duplicado → `cuit`; email ya registrado → `email` del acceso).
  - Un 400 muestra "Revisá los datos".
  - Un 404 hace `notFound()`.
  - El resto da "No se pudo conectar con el servidor".
- **Reactivar:** hace `GET /clientes/:id` y después un `PUT` con los mismos datos y `activo: true`.
- **Al terminar bien**, redirigen al detalle con un aviso en la URL: `/clientes/[id]?ok=creado|editado|baja|reactivado|acceso`.
  - El detalle lo muestra en un `role="status"` ("Cliente creado", "Cambios guardados", "Cliente dado de baja", "Cliente reactivado" o "Acceso creado") con un link para cerrarlo.
  - Así funciona sin JS. No uses toasts para esto.
- Verificá en la doc de Next que, después de una Server Action con `redirect()`, el detalle se muestre con los datos nuevos. Si hace falta, usá `revalidatePath` o la API que recomiende la doc de 16.4.6 (todo el panel es `no-store`).

**Formulario de cliente** (`components/clientes/formulario-cliente.tsx`, cliente con `useActionState`):
- Lo usan alta y edición.
- **Campos:**
  - Razón social.
  - CUIT, con la ayuda "Podés escribirlo con o sin guiones".
  - Email de contacto.
  - Teléfono (opcional).
  - Condición frente al IVA, con un **`<select>` nativo**.
- Cada error va debajo de su campo, con `aria-invalid` y `aria-describedby`.
- El botón dice "Guardar" y pasa a "Guardando…" mientras se envía (usá el `pending` de `useActionState`).
- Lleva un link "Cancelar" que vuelve al detalle o al listado.
- **Tiene que funcionar sin JS**: los Server Actions con `<form action={…}>` lo soportan.

**Páginas** (todas con `instant = false`):
- **`/clientes/nuevo`:** formulario vacío.
- **`/clientes/[id]`:** detalle.
  - Muestra los datos (CUIT con formato, condición IVA en texto, teléfono o "—", el estado y si tiene acceso).
  - Acciones:
    - **Editar:** link a `/clientes/[id]/editar`.
    - **Dar de baja:** solo si está activo. La confirmación va por la URL: el botón es un link a `?confirmar=baja`, y con ese parámetro la página muestra un recuadro "¿Dar de baja a {razón social}? Va a dejar de poder ingresar con su acceso." con un form "Sí, dar de baja" (Server Action `darDeBaja`) y un link "Cancelar". Así funciona con y sin JS, y no hace falta `alert-dialog`.
    - **Reactivar:** solo si está dado de baja. Es un form con la action `reactivarCliente`.
    - **Crear acceso:** solo si está activo y `usuarioId` es `null`. Es un formulario con email de login, contraseña inicial (8–72) y nombre opcional, que usa la action `crearAcceso`. Si ya tiene acceso, se muestra "Tiene acceso al portal de clientes".
- **`/clientes/[id]/editar`:** el formulario con los datos actuales. Si el cliente está dado de baja, igual se puede editar; no se tocan los datos de `activo`.
- **No encontrado:** si el `id` no es un UUID (validalo antes de llamar a la API) o la API responde 404, llamá a `notFound()`. Agregá `src/app/(panel)/clientes/[id]/not-found.tsx` con "Cliente no encontrado" y un link al listado.
- **Componentes de shadcn:** si hacen falta, `table` y `badge`. Agregalos con `npx shadcn@latest add …` y **revisá después que no haya cambiado la versión de `recharts`** u otras en `package.json`; ya pasó una vez (ver CLAUDE.md). No agregues `select` ni `alert-dialog`.

## D. Tests

### Unitarios (Vitest, `src/**/*.test.ts`)

- **`lib/cuit.test.ts`:** CUIT válidos e inválidos (dígito verificador 0, resto 10, largo incorrecto, letras), normalización con guiones y espacios, y formato.
- **`lib/clientes.test.ts`:** `validarCliente`, `validarAcceso`, `leerFiltrosClientes` (valores por defecto, valores inválidos y repetidos), el cálculo de páginas y las URLs de paginación (conservan los filtros y omiten los valores por defecto).

### E2E (Playwright)

**Infraestructura del admin propio:**
- En `e2e/global-setup.ts`, después de loguear al admin de demo, **registrá un admin propio** con `POST /api/auth/registro` del dashboard. Usá un email único, `e2e-clientes-<timestamp>-<random>@example.com`, y guardá su sesión en `e2e/.auth/admin-propio.json`. El registro hace el login automático: es **1 login más**.
- Exportá `RUTA_SESION_PROPIA` desde `e2e/env.ts`.
- Si la respuesta trae `sesion: false`, lanzá `MENSAJE_429`.
- **Cuenta de logins por corrida: 7.** Uno del admin de demo y uno del propio en `global-setup`, cuatro de los tests de login por la UI, y uno del registro exitoso. Actualizá los comentarios y textos que dicen "6": `MENSAJE_429` en `e2e/env.ts`, `e2e/auth.spec.ts`, `e2e/global-setup.ts`, `playwright.config.ts` y la sección Tests del CLAUDE.md.
- Agregá un helper que lea el token de una sesión guardada (hoy `tokenDeSesion()` está dentro de `e2e/inicio.spec.ts`; movelo a `e2e/fixtures.ts` y hacé que reciba la ruta).
- Agregá también `crearClienteApi(token, datos)`, que crea clientes por la API desde Node para preparar datos.
- Agregá un generador de **CUIT aleatorio válido** que use `cuitValido`/el cálculo de `src/lib/cuit.ts` (los e2e pueden importar módulos puros de `src/`).
- Cada test que modifica datos crea sus propios clientes, con razón social `E2E <algo> <sufijo único>`. No dependas del orden entre tests.

**Con el admin de demo (solo leen)**, en `e2e/clientes-lectura.spec.ts` con `storageState: RUTA_SESION_ADMIN`:
1. **Barra de navegación:** "Inicio" está activo en `/` y "Clientes" en `/clientes` y en `/clientes/<id>` (con `aria-current`). "Vencimientos" no es un link. Se ven el saludo "Hola, {E2E_ADMIN_NOMBRE}" y "Cerrar sesión".
2. **Listado por defecto:** muestra los clientes activos que devuelve `GET /clientes?activo=true` desde Node, con la misma cantidad y las mismas razones sociales. El CUIT aparece con formato.
3. **Búsqueda por razón social** (un fragmento de un cliente de la API) y **por CUIT** (con guiones). La URL refleja `buscar`.
4. **Filtro "Dados de baja":** muestra el cliente inactivo de demo (tomado de la API) y no muestra los activos.
5. **No encontrado:** `/clientes/<uuid aleatorio>` y `/clientes/no-es-uuid` muestran "Cliente no encontrado".
6. **Celular (390 px):** el listado se ve en tarjetas, sin scroll horizontal, y la barra de navegación entra en el ancho.

**Con el admin propio (modifican datos)**, en `e2e/clientes-edicion.spec.ts` con `storageState: RUTA_SESION_PROPIA`:
1. **Alta:** completar el formulario lleva al detalle con "Cliente creado", y el cliente aparece en el listado.
2. **Validación:** un CUIT inválido muestra "El CUIT no es válido" sin llamar a la API, y una razón social vacía muestra su error. Los valores cargados se conservan.
3. **CUIT duplicado** (crear uno por la API y repetir su CUIT): muestra "Ya existe un cliente con ese CUIT" en el campo CUIT.
4. **Alta sin JS** (`javaScriptEnabled: false`): funciona y llega al detalle.
5. **Edición:** cambiar el teléfono y la condición IVA, guardar, ver "Cambios guardados" y los datos nuevos.
6. **Baja con confirmación:** "Dar de baja" muestra la pregunta; "Cancelar" no cambia nada; "Sí, dar de baja" muestra "Cliente dado de baja" y el estado cambia. El cliente desaparece del listado "Activos" y aparece en "Dados de baja". Después, "Reactivar" muestra "Cliente reactivado".
7. **Crear acceso:** con email único, muestra "Acceso creado" y "Tiene acceso", y el formulario ya no aparece. En otro cliente, usar como email el del admin de demo (`E2E_ADMIN_EMAIL`) muestra "El email ya está registrado".
8. **Paginación:** crear 21 clientes por la API, con razón social `E2E Pag <sufijo> NN`, y buscar por `E2E Pag <sufijo>`. La página 1 muestra 20 y "Página 1 de 2"; "Siguiente" lleva a la página 2 con 1 cliente y conserva `buscar`; "Anterior" vuelve. Una `pagina=9` muestra el mensaje de vacío con un link a la página 1.
9. **Estudio sin clientes:** no va en este spec, porque el admin propio ya tiene clientes de otros tests. Extendé el test "registro exitoso" de `e2e/registro.spec.ts`, que ya entra con un estudio nuevo y vacío (sin sumar logins): después de verificar el Inicio, que vaya a `/clientes` y vea "Todavía no cargaste clientes" con el link "Nuevo cliente".

**El fixture automático** sigue verificando que el navegador nunca llame a la API (`:3000`). No lo desactives.

## E. Documentación

- **CLAUDE.md:**
  - Agregá la sección "Decisiones de implementación (paso 3: Clientes)": la barra de navegación, los parámetros de URL, el `<select>` nativo, la confirmación por URL, el `?ok=` para los avisos, cómo se reactiva, el manejo de errores por idioma y el admin propio en los e2e.
  - Actualizá la sección Tests: los specs nuevos, el admin propio, los 7 logins y `RUTA_SESION_PROPIA`.
  - Confirmá que "Pendiente para el deploy" incluya el script de limpieza de admins de prueba.
  - Marcá el paso 3 como hecho en "Orden de trabajo".
- No toques el README; es del paso 5.

## Verificación final

En Windows, corré todo desde PowerShell con `Set-Location 'C:\Users\Edgardo\workspace\claudecode\contable-dashboard'`, con la unidad en **mayúscula**. Con `c:\` en minúscula, Vitest falla en todas las suites con `Cannot read properties of undefined (reading 'config')`.

1. `npx tsc --noEmit`
2. `npm run lint`
3. `npm test`
4. `npm run build`
5. `npm run test:e2e`, dos veces seguidas, para confirmar que no dependen de datos que dejó la corrida anterior.
6. Revisá en `next dev` que no aparezca "Next.js encountered uncached data" al navegar las páginas nuevas.
7. Revisá visualmente el listado y el detalle en tema claro y oscuro (con `colorScheme` de Playwright) y a 390 px.

Al terminar, armá un resumen con las decisiones que tomaste por tu cuenta, lo que quedó pendiente y el resultado de cada verificación. **Sin commits.**
