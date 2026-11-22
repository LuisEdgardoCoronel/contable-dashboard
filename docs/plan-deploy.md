# Plan del deploy

**Estado: pendiente.** Se armó como plan del paso 5 (README + deploy). El deploy se postergó y el paso 5 pasó a ser el cierre del proyecto, que ya resolvió **B3** (solo el test del 404), **B4** (scroll a la pestaña activa), **B5** (`.node-version`) y **C** (README), marcados con ✅. El resto sigue pendiente.

Está escrito para que una sesión nueva lo ejecute sin el historial de la conversación en que se armó. Cubre los dos repos: `contable-dashboard` (este) y `contable-api` (`../contable-api`). Los pasos que tiene que hacer el usuario a mano en el panel de Railway están marcados con **🧑 Usuario (Railway)**; el resto lo puede hacer una sesión de Claude Code.

Orden de trabajo: **A** (cambios en la API) → **B** (cambios en el dashboard) → **C** (README) → **D** (deploy en Railway) → **E** (verificación en producción). Cada etapa se cierra con sus tests en verde antes de pasar a la siguiente.

## Antes de empezar

1. Leé `CLAUDE.md` y `AGENTS.md` de este repo y `../contable-api/CLAUDE.md`. Este plan no repite sus reglas. En especial:
   - **Git:** no corras comandos que modifiquen el repo o el árbol de trabajo sin preguntar, **en ninguno de los dos repos**. Solo lectura está bien. **Sin commits.** El usuario commitea.
   - "Pendiente para el deploy" (dashboard) y "Rate limit del login" (API): son el punto de partida de la sección "Pendientes".
2. Verificá que los dos árboles estén limpios (`git status` en cada repo) y corré la verificación completa de los dos para tener una base verde (ver "Verificación final"). `test:e2e:prod` hoy tiene 1 fallo conocido (el del 404).
3. Si hay dudas sobre Next, `node_modules/next/dist/docs/` (Next 16.4.6, Cache Components). Para Railway, su documentación oficial: lo que este plan marca como **(verificar)** son comportamientos de Railway que hay que confirmar en sus docs o en el primer deploy, no supuestos firmes.

## Decisiones a confirmar con el usuario antes de ejecutar

Son de producto. El plan asume la opción recomendada en cada una. **Respuesta preliminar del usuario (2026-11-22): sí a las tres.** Confirmarlas antes de ejecutar el deploy.

1. **¿El deploy es una demo pública?** Recomendado: **sí**. El README muestra las credenciales de demo (`demo@example.com` / `demo1234`), cualquiera puede entrar y modificar esos datos, y un cron los restablece todas las noches (ver D7). El registro sigue abierto para quien quiera un estudio propio y vacío. Alternativa: deploy "real", sin `seed:demo` ni credenciales públicas.
   → **Preliminar: sí, demo pública con cron.**
2. **¿La API tiene dominio público?** Recomendado: **sí**, para que Swagger (`/docs`) se pueda mirar desde el README. El dashboard igual le habla por la red privada de Railway. Alternativa: API solo en la red privada (más simple: no hace falta `trust proxy`, pero no hay Swagger público).
   → **Preliminar: sí, Swagger público.**
3. **Dominios:** recomendado empezar con los subdominios `*.up.railway.app` que genera Railway. Un dominio propio se puede sumar después sin cambiar código (solo `API_URL` si cambia el de la API, que el dashboard no usa: usa la red privada).
   → **Preliminar: sí, subdominios de Railway primero.**

## Pendientes para el deploy: qué se resuelve dónde

| Pendiente (de CLAUDE.md) | Dónde | Decisión |
|---|---|---|
| Admins `e2e-*@example.com` que quedan en la base | **API** | Script `limpiar:e2e` (A1). Los tests no lo llaman. |
| `POST /auth/register` público y sin rate limit | **API** + mensaje en el **dashboard** | Rate limit por IP real (A2) + mensaje 429 en el registro (B2). Captcha y verificación de email: **se aceptan como pendientes** (fuera de alcance del MVP; se documentan en el README). |
| Rate limit del login compartido por todos (todo llega desde la IP de Next) | **API** + **dashboard** | El dashboard reenvía la IP real en un header firmado con un secreto compartido; la API solo lo acepta si el secreto coincide (A3, B1). La API además configura `trust proxy` para los requests que le llegan directo por su dominio público. |
| Contadores del throttler en memoria (API) | — | **Se acepta**: una sola instancia en Railway. Documentado (README de la API). Si se escala, Redis. |
| Status 200 en vez de 307/404 en producción | **Dashboard** | **Se acepta y se documenta** (B3). Se adapta el test del 404. |
| Errores de formularios sin JS en producción | — | Ya aceptado (sección propia en CLAUDE.md). Solo se menciona en el README. |

### A. Cambios en la API (`../contable-api`)

**A1. Script de limpieza de datos e2e** (`npm run limpiar:e2e`).
- `src/database/seeds/limpiar-e2e.ts` (o `src/database/scripts/`, si se prefiere no mezclar con seeds): en una transacción, busca los usuarios admin con `email LIKE 'e2e-%@example.com'` y borra, en este orden (las FK son `RESTRICT`): vencimientos de sus clientes → los clientes → los usuarios cliente vinculados (`usuario_id` de esos clientes) → los admins. Imprime cuántos borró de cada cosa.
- El patrón: el prefijo `e2e-` lo usan `registro.spec.ts` (`e2e-<timestamp>@…`) y `global-setup.ts` (`e2e-clientes-<timestamp>-<random>@…`). Revisá también los emails de los usuarios cliente que crean los tests de acceso: si no empiezan con `e2e-`, se borran igual porque se llega a ellos por `clientes.usuario_id`.
- Se niega a correr con `NODE_ENV=production` (igual que `seed:demo`): en producción no corren e2e.
- Test: un e2e de la API que cree un admin `e2e-…` con un cliente, un vencimiento y un acceso, corra la función y verifique que no queda nada, y que un admin con otro email no se toca.
- Documentarlo en el README de la API y en "Tests" de este CLAUDE.md ("después de varias corridas, `npm run limpiar:e2e` en la API").

**A2. Rate limit del registro.**
- Segundo throttler con nombre: `{ name: 'registro', ttl: REGISTRO_VENTANA_MS = 3_600_000, limit: REGISTRO_RATE_LIMIT }`, con `REGISTRO_RATE_LIMIT` opcional en `env.validation.ts` (default **10 por hora por IP**, entero ≥ 1), igual que `LOGIN_RATE_LIMIT`.
- Con varios throttlers, `ThrottlerGuard` aplica **todos** en cada ruta donde se usa: `POST /auth/login` lleva `@SkipThrottle({ registro: true })` y `POST /auth/register`, `@UseGuards(ThrottlerGuard)` + `@SkipThrottle({ login: true })` (verificar el comportamiento en `@nestjs/throttler` 6.x; si conviene, `@Throttle` por ruta).
- `opcionesRateLimitLogin()` pasa a armar los dos (renombrarla, p. ej. `opcionesRateLimit({ login, registro })`); `crearApp({ rateLimitLogin })` de los e2e se extiende con `rateLimitRegistro`.
- Test e2e: con `rateLimitRegistro: 2`, el tercer registro da 429; el login no se ve afectado.
- En el `.env` local, subirlo también (los e2e del dashboard registran un admin por corrida en `global-setup` y otro en `registro.spec.ts`). Sumarlo a `.env.example` y a la nota de "Rate limit" de los dos CLAUDE.md.

**A3. IP real del cliente.**
- **Guard propio** `ThrottlerIpRealGuard extends ThrottlerGuard` (`src/common/guards/`), que sobreescribe `getTracker(req)`:
  1. Si el request trae `X-Dashboard-Secret` y coincide con `DASHBOARD_SECRET` (comparación con `timingSafeEqual`, largo igual), y trae `X-Cliente-IP` con una IP válida (`net.isIP`), usa esa IP.
  2. Si no, `req.ip`.
  - Un header `X-Cliente-IP` sin el secreto, o con uno incorrecto, se **ignora** (no da error): así nadie puede elegir su IP desde afuera.
- `DASHBOARD_SECRET`: variable **opcional** (≥ 32 caracteres si está). Sin ella, el guard nunca acepta `X-Cliente-IP` (desarrollo local sin cambios).
- **`trust proxy`** en `main.ts` (no en `configurarApp`, para no afectar los e2e): `app.set('trust proxy', TRUST_PROXY)` con una variable opcional `TRUST_PROXY` (cantidad de saltos; en Railway, **1** (verificar): el edge de Railway agrega su `X-Forwarded-For`). Sin la variable, no se configura (local). Esto cubre los requests que llegan directo al dominio público de la API (Swagger, curl), que pasan por el edge.
- Los requests del dashboard llegan por la red privada (sin edge): `req.ip` es la IP privada del contenedor de Next, y la IP real viaja en `X-Cliente-IP`.
- Usar el guard en login y registro en lugar de `ThrottlerGuard`.
- Tests unitarios de `getTracker` (con y sin secreto, secreto incorrecto, IP inválida, sin `DASHBOARD_SECRET` configurado) y un e2e: dos "IPs" distintas con el secreto correcto tienen contadores separados; con secreto incorrecto comparten el de `req.ip`.
- Actualizar en el CLAUDE.md de la API el párrafo "Proxy" de "Rate limit del login" (deja de estar "no configurado").

**A4. Scripts de producción** (en Railway no conviene depender de `ts-node`, que es devDependency).
- `migration:run:prod`: `typeorm migration:run -d dist/database/data-source.js` (`typeorm` está en `dependencies`; `dist/database/` ya se compila con `nest build`, verificado: incluye `migrations/` y `seeds/`, y el glob de `data-source.ts` acepta `.js`).
- `seed:prod`: `node dist/database/seeds/run-seed.js` (impuestos). Verificar que `seedImpuestos` sea idempotente (upsert por `codigo`) porque corre en cada deploy; si no lo es, hacerlo.
- `seed:demo:prod`: `node dist/database/seeds/run-seed-demo.js`.
- **`seed:demo` en producción:** hoy se niega con `NODE_ENV=production`. Si se confirma la decisión 1 (demo pública), que acepte correr en producción **solo** con `PERMITIR_SEED_DEMO=true` explícito. El mensaje de error lo menciona. El servicio de la API **no** tiene esa variable; solo el cron (D7).
- Probar los tres scripts en local contra la base de Docker después de `npm run build`.

**A5. Healthcheck.** `GET /salud` con `@Public()`, que hace `SELECT 1` y responde `{ ok: true }` (503 si la base no responde). Sin `@ApiBearerAuth`. Lo usa Railway para saber que el deploy levantó (D4). E2e simple.

**A6. Node y build.** Confirmar que el builder de Railway (Railpack) instala Node 26 desde `.node-version` / `engines` **(verificar)**. Si no lo soporta todavía, fijar la versión con la variable que indique su documentación (p. ej. `RAILPACK_NODE_VERSION`) o un `Dockerfile` mínimo (`node:26-slim`, `npm ci`, `npm run build`, `npm prune --omit=dev`). Preferir no agregar Dockerfile si Railpack alcanza.

**A7. README de la API:** sección "Deploy en Railway" corta (variables, scripts de producción, healthcheck, que el detalle está en `contable-dashboard/docs/plan-deploy.md` o en el README del dashboard) y la URL pública de Swagger cuando exista. Sacar "Supabase y deploy en Railway" de "Fuera de alcance" en su CLAUDE.md.

### B. Cambios en el dashboard

**B1. Reenviar la IP real.**
- `apiFetch` acepta una opción `ipCliente?: string`. Si viene y `env.DASHBOARD_SECRET` existe, agrega `X-Cliente-IP` y `X-Dashboard-Secret`. Sin secreto configurado, no manda nada (local igual que hoy).
- `src/lib/env.ts`: `DASHBOARD_SECRET` **opcional** (si está, ≥ 32 caracteres; si no, error al arrancar como `API_URL`).
- Helper `ipDelRequest(request)` en `src/lib/auth/` (`server-only`): lee la IP que agrega el edge de Railway. Railway manda `X-Forwarded-For` (y posiblemente `X-Real-IP`) **(verificar en el primer deploy qué headers llegan y en qué orden)**; tomar la entrada que agrega el edge (la última de `X-Forwarded-For`, no la primera, que la puede inventar el cliente), validarla con `net.isIP`, o `undefined`. En Next 16, `NextRequest` ya no tiene `.ip`. Tests unitarios.
- Solo lo usan los dos lugares que pegan contra endpoints con rate limit: `iniciarSesion()` (que pasa a recibir la IP; la llaman `/api/auth/login` y `/api/auth/registro`) y el `POST /auth/register` del handler de registro.
- Sumar `DASHBOARD_SECRET` a `.env.example` (comentado, "solo en producción").

**B2. 429 en el registro.** `MENSAJES` de `api/auth/registro/route.ts`: 429 → "Demasiados registros desde esta conexión. Probá de nuevo más tarde". Actualizar "Mensajes del registro" en CLAUDE.md. Test e2e: interceptar no sirve (el navegador no llama a la API); probarlo con un test unitario del handler o dejarlo cubierto por el e2e de la API. Recomendado: test unitario del mapeo de mensajes, si el handler se puede testear sin levantar Next; si no, solo el de la API.

**B3. Status codes en producción (se acepta).** ✅ Test del 404 adaptado en el cierre; falta el `noindex` y mover la explicación en CLAUDE.md.
- **Por qué se acepta:** el 307 perdido solo afecta a un token que el proxy considera válido pero la API rechaza. El proxy ya descarta los tokens vencidos (decodifica `exp`), y la API no revoca tokens de admin (no hay baja de admins): en la práctica solo pasa si se rota `JWT_SECRET`. Con JS el navegador termina en `/login` igual. El 404 con status 200 afecta solo a crawlers, y el panel es privado.
- **Hacer:** `robots: { index: false, follow: false }` en el `metadata` del layout raíz (y `public/robots.txt` con `Disallow: /`), así el 200 de "no encontrado" no importa.
- Test `clientes-lectura › un id inexistente o que no es UUID…`: verificar el status solo en dev (`expect(status).toBe(404)` si `process.env.E2E_PROD` no está; en prod, que sea 200 o 404) y siempre el heading. `playwright.prod.config.ts` setea esa variable. Así `test:e2e:prod` queda 58/58. Revisá si `vencimientos-lectura` tiene el mismo chequeo de status para el "Vencimiento no encontrado".
- Mover la explicación de "Pendiente para el deploy" a una sección "Diferencias de producción (aceptado)" en CLAUDE.md, como la de formularios sin JS. Mencionar en el README.

**B4. Scroll automático a la pestaña activa en el celular.** ✅ Hecho en el cierre.
- Problema: en 390 px, `Presentados` y `Todos` quedan fuera de la `<nav>` con scroll horizontal (`components/vencimientos/pestanas.tsx`); entrando por `?estado=todos` (o desde la tarjeta "Presentados" del Inicio) la pestaña activa no se ve.
- Solución: un componente cliente chico, `components/vencimientos/scroll-pestana-activa.tsx` (`'use client'`), que envuelve el `<ul>` o recibe un `ref` de la `<nav>`. `Pestanas` sigue siendo Server Component y lo usa como contenedor.
  - En `useLayoutEffect` (antes de pintar, sin salto visible), con `estado` como dependencia: busca `[aria-current="page"]` dentro de la `<nav>` y, **si no está entera a la vista**, ajusta `nav.scrollLeft` para centrarla (`link.offsetLeft - (nav.clientWidth - link.offsetWidth) / 2`; el navegador recorta a los límites).
  - **No usar `scrollIntoView`**: también mueve el scroll vertical de la página.
  - Sin animación (`scrollLeft` directo), así no hace falta mirar `prefers-reduced-motion`.
  - Si la pestaña ya se ve entera (escritorio, o "Vencidos"), no toca nada.
  - Sin JS no hace nada: la pestaña se alcanza con scroll manual, como hoy (aceptable).
  - Rutas ocultas de Next 16 (Activity): los efectos se vuelven a correr al mostrarse; verificar volviendo atrás entre pestañas.
- Test e2e en `vencimientos-lectura.spec.ts`, dentro del `describe` de 390 px: abrir `/vencimientos?estado=todos` y verificar que el `boundingBox` del link con `aria-current="page"` queda dentro del de la `<nav aria-label="Estado">`; lo mismo navegando con click de `Vencidos` a `Todos` (hacer scroll manual de la nav primero si hace falta), y que `window.scrollY` no cambió. Un caso de escritorio: `scrollLeft` sigue en 0.
- Agregar la decisión a "Decisiones de implementación (paso 4)" en CLAUDE.md (línea de "Pestañas").

**B5. Node en Railway.** ✅ Hecho en el cierre: `.node-version` con `26` (como la API).

**B6. Puerto.** `next start -p 3001` ignora `PORT`. **No cambiar el script**: en Railway se configura el puerto de destino del dominio en 3001 (D5). Así `npm start` sigue igual en local.

**B7. Build sin API.** Confirmar que `next build` no llama a la API (todo el panel es dinámico; la red privada de Railway **no** está disponible durante el build). Prueba: `npm run build` en local con la API apagada y `API_URL` apuntando a ella. Si algo la llama, corregirlo antes del deploy.

### C. README del dashboard ✅

Hecho en el cierre, sin capturas. Al deployar: sumar la URL de la demo y una sección corta de deploy.

Reemplaza el README del template. En español rioplatense, con el mismo estilo que el de la API (mismo nivel de detalle, tablas donde ayuden). Secciones:

1. **Qué es:** panel para contadores sobre `contable-api` (link al repo). **Demo:** URL de producción + credenciales `demo@example.com` / `demo1234`, aclarando que los datos se restablecen cada noche y que cualquiera puede modificarlos; o registrarse para un estudio vacío. (Si la decisión 1 es "no demo", sin credenciales.)
2. **Capturas** (opcional, si el usuario las quiere): Inicio, listado de vencimientos y celular. Se pueden sacar con Playwright contra la demo; guardarlas en `docs/capturas/`.
3. **Funcionalidades:** inicio con estadísticas y gráficos, clientes, vencimientos con pestañas, registro, tema claro/oscuro del sistema, responsive, funciona sin JS en los casos exitosos.
4. **Stack:** tabla (Next 16 App Router + Cache Components, React 19, TypeScript, Tailwind 4, shadcn/ui sobre Base UI, Recharts, Vitest, Playwright, openapi-typescript).
5. **Arquitectura:** diagrama corto (Navegador → Next (Server Components / Server Actions / route handlers de auth) → contable-api → Postgres) y por qué el navegador nunca llama a la API (token en cookie httpOnly, sin CORS, la API puede quedar en red privada).
6. **Decisiones destacadas:** auth con cookie httpOnly y `rutaSegura`; proxy que decodifica `exp` sin verificar; 401 → `/api/auth/salir`; tipos generados desde OpenAPI; fechas como string (nunca `new Date()`); estado de vencimientos de la API; filtros en la URL; formularios con Server Actions y avisos por URL; accesibilidad (colores Okabe-Ito, `aria-current`, el color nunca es la única pista); IP real reenviada para el rate limit.
7. **Cómo correrlo en local:** requisitos (Node 26, la API corriendo con `seed:demo`); `npm install`; `.env.local` desde `.env.example`; `npm run dev` (puerto 3001); `npm run types` con la API arriba.
8. **Scripts:** tabla de `dev`, `build`, `start`, `lint`, `types`, `test`, `test:e2e`, `test:e2e:prod`.
9. **Tests:** unitarios y e2e; `.env.test`; `LOGIN_RATE_LIMIT` y `REGISTRO_RATE_LIMIT` altos en la API; `npm run limpiar:e2e` en la API; la nota de Windows (`C:\` en mayúscula).
10. **Deploy:** resumen de la topología en Railway y las variables (tabla), con link a este plan para el paso a paso.
11. **Limitaciones conocidas:** errores de formularios sin JS en producción, status 200 en vez de 404/307 en producción, rate limit en memoria (una instancia), registro sin captcha ni verificación de email, sin recuperación de contraseña.

No poner secretos ni el `JWT_SECRET`. Verificar cada comando del README corriéndolo.

### D. Deploy en Railway

Topología: **un proyecto** de Railway con cuatro servicios: `Postgres`, `contable-api`, `contable-dashboard` y (si hay demo pública) `demo-reset` (cron). Un solo entorno (`production`).

Los nombres de servicio importan: las referencias `${{contable-api.X}}` usan el nombre exacto. Si se usan otros nombres, ajustar las referencias.

**D1. Preparación** (Claude Code, antes de tocar Railway)
- Etapas A, B y C terminadas, con tests en verde en los dos repos.
- 🧑 **Usuario:** commitear y pushear los dos repos a GitHub (Railway despliega desde la rama `main`).
- Generar en local los dos secretos (no se guardan en ningún archivo del repo): `JWT_SECRET` y `DASHBOARD_SECRET`, cada uno con `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`.

**D2. Proyecto y base de datos**
- 🧑 **Usuario (Railway):** crear el proyecto (New Project → Empty Project). Elegir región (la más cercana a Argentina que ofrezca Railway, p. ej. US East **(verificar las disponibles)**).
- 🧑 **Usuario (Railway):** agregar Postgres (New → Database → PostgreSQL), nombre del servicio `Postgres`. Railway trae por defecto una versión más nueva que la 16 **(verificar)**; las migraciones no usan nada específico de 16 (`gen_random_uuid()` es nativo desde 13), así que cualquier ≥ 16 sirve. Si se quiere exactamente 16, elegir la imagen de 16 en la configuración del servicio.
- Confirmar que el volumen persistente está creado (Railway lo crea con la plantilla) y, si el plan de Railway lo permite, activar backups.

**D3. Servicio `contable-api`**
- 🧑 **Usuario (Railway):** New → GitHub Repo → `contable-api`. Nombre del servicio: `contable-api`. Rama `main`.
- 🧑 **Usuario (Railway), Settings:**
  - Build command: `npm run build` (Railpack lo detecta solo; confirmarlo).
  - Start command: `npm run start:prod`.
  - **Pre-deploy command:** `npm run migration:run:prod && npm run seed:prod`. Corre antes de cada deploy, con las variables del servicio y acceso a la red privada **(verificar)**; si falla, el deploy no se publica.
  - Healthcheck path: `/salud`.
  - Restart policy: on failure.
  - Réplicas: **1** (el rate limit es en memoria).
- 🧑 **Usuario (Railway), Variables** (pestaña Variables del servicio; las `${{…}}` son referencias que Railway resuelve):

  | Variable | Valor |
  |---|---|
  | `DB_HOST` | `${{Postgres.PGHOST}}` (host privado) |
  | `DB_PORT` | `${{Postgres.PGPORT}}` |
  | `DB_USER` | `${{Postgres.PGUSER}}` |
  | `DB_PASSWORD` | `${{Postgres.PGPASSWORD}}` |
  | `DB_NAME` | `${{Postgres.PGDATABASE}}` |
  | `JWT_SECRET` | el generado en D1 |
  | `JWT_EXPIRES_IN` | `1d` |
  | `LOGIN_RATE_LIMIT` | `5` |
  | `REGISTRO_RATE_LIMIT` | `10` |
  | `DASHBOARD_SECRET` | el generado en D1 |
  | `TRUST_PROXY` | `1` |
  | `NODE_ENV` | `production` |

  - `PORT` **no se define**: Railway la inyecta y la API ya la lee. Si `PGHOST` no es el host privado (`postgres.railway.internal`), usar la variable privada que indique la plantilla **(verificar los nombres en la pestaña Variables de Postgres)**.
  - Por la red privada no hace falta SSL; `database.config.ts` no lo configura y está bien así. Si en algún momento la API se conecta por el proxy público de Postgres, habría que agregar `ssl`.
  - Red privada: la API tiene que escuchar en IPv6 (`::`). `app.listen(port)` sin host ya lo hace en Node; confirmarlo en el primer deploy (el dashboard la tiene que alcanzar).
- 🧑 **Usuario (Railway):** Networking → Generate Domain (si se confirma la decisión 2). Queda algo como `contable-api-production.up.railway.app`. Abrir `/docs` y `/salud`.

**D4. Primer deploy de la API y seed**
- 🧑 **Usuario (Railway):** Deploy. En los logs del pre-deploy tiene que verse la migración `Init` aplicada y "Seed OK: 6 impuestos". En el segundo deploy, ninguna migración pendiente y el seed sin duplicar.
- **Seed de demo (solo si hay demo pública):** se carga con el cron de D7 ("Run now" la primera vez). No se corre desde el servicio de la API ni desde la máquina local (la base no es accesible desde afuera sin el proxy público, y no hace falta abrirlo).

**D5. Servicio `contable-dashboard`**
- 🧑 **Usuario (Railway):** New → GitHub Repo → `contable-dashboard`. Nombre: `contable-dashboard`. Rama `main`.
- 🧑 **Usuario (Railway), Settings:** build `npm run build`, start `npm run start` (escucha en 3001), healthcheck path `/login` (pública, responde 200 sin sesión), restart on failure.
- 🧑 **Usuario (Railway), Variables:**

  | Variable | Valor |
  |---|---|
  | `API_URL` | `http://${{contable-api.RAILWAY_PRIVATE_DOMAIN}}:${{contable-api.PORT}}` |
  | `DASHBOARD_SECRET` | `${{contable-api.DASHBOARD_SECRET}}` (referencia, así hay un solo valor) |

  - `NODE_ENV` lo pone `next start`. La cookie sale con `secure` porque `NODE_ENV=production` y el dominio es HTTPS.
  - `API_URL` se valida al arrancar (`instrumentation.ts`): si la referencia queda mal resuelta, el servicio no levanta y el log lo dice.
  - Si `${{contable-api.PORT}}` no resuelve (Railway inyecta `PORT` en tiempo de ejecución y puede no exponerla como referencia) **(verificar)**, definir `PORT=3000` explícito en la API y usar `:3000` acá.
- 🧑 **Usuario (Railway):** Networking → Generate Domain, con **puerto de destino 3001**. Queda algo como `contable-dashboard-production.up.railway.app`.

**D6. Dominios propios (opcional)**
- 🧑 **Usuario (Railway + proveedor DNS):** en el servicio del dashboard, Networking → Custom Domain (p. ej. `panel.tudominio.com`). Railway muestra un `CNAME` (y a veces un `TXT` de verificación) para cargar en el DNS. El certificado lo emite Railway. Lo mismo para la API (`api.tudominio.com`) si se quiere Swagger en un dominio propio.
- No hay que cambiar variables: el dashboard llega a la API por la red privada, y la cookie no tiene `domain` (queda atada al host que la sirvió).

**D7. Cron de la demo (solo si hay demo pública)**
- 🧑 **Usuario (Railway):** New → GitHub Repo → `contable-api` otra vez, nombre `demo-reset`.
  - Start command: `npm run seed:demo:prod`. Sin dominio, sin healthcheck.
  - Cron schedule: `0 6 * * *` (Railway usa UTC: 03:00 en Argentina).
  - Variables: las mismas `DB_*` y `JWT_SECRET` que la API (referencias `${{contable-api.DB_HOST}}`, etc., o copiar las de Postgres), `JWT_EXPIRES_IN=1d`, `NODE_ENV=production`, **`PERMITIR_SEED_DEMO=true`**. `PORT` no la usa, pero `validateEnv` la exige: definir `PORT=3000`.
  - "Run now" una vez para cargar la demo. Verificar en los logs "Seed demo OK".
- Al restablecer conserva el id del admin, así que las sesiones abiertas de la demo siguen funcionando; los cambios de los visitantes se pierden cada noche (lo dice el README).
- Los datos de `seed:demo` son relativos a "hoy": sin el cron, a las pocas semanas los "próximos" pasan a vencidos. Es otra razón para restablecer todas las noches.

### E. Verificación en producción

Con las URLs reales (Claude Code puede hacer las que no requieren el panel de Railway; Playwright contra producción **no** se corre como suite: crearía admins `e2e-*` en la base real).

1. `GET https://<api>/salud` → 200; `/docs` abre Swagger.
2. Dashboard: `/` sin sesión → `/login`; login con la demo → Inicio con datos; la cookie `contable_token` tiene `HttpOnly`, `Secure`, `SameSite=Lax` (DevTools).
3. Recorrer clientes y vencimientos en el celular (incluido el scroll de la pestaña activa con `?estado=todos`).
4. En la pestaña Network del navegador, ningún request va al dominio de la API.
5. **Rate limit por IP real:** 6 logins fallidos seguidos desde una conexión → 429 en el sexto; desde otra conexión (datos del celular) en el mismo minuto, el login funciona. Repetirlo prueba que el límite ya no es compartido.
6. **Sin secreto no se puede elegir la IP:** `curl` al `POST /auth/login` de la API pública con `X-Cliente-IP` variando y sin `X-Dashboard-Secret`: al sexto da 429 igual.
7. 🧑 **Usuario (Railway):** revisar en los logs del dashboard qué headers de IP llegan (B1) si el punto 5 falla.
8. Registro de un estudio nuevo → listado vacío "Todavía no cargaste clientes".
9. Al día siguiente: los datos de la demo se restablecieron (log del cron).

## Verificación final (local, antes del deploy)

En `contable-api`: `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build` y los tres scripts `:prod` contra la base local.

En `contable-dashboard` (desde `C:\`, en mayúscula): `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run test:e2e` (API con `LOGIN_RATE_LIMIT` y `REGISTRO_RATE_LIMIT` altos) y `npm run test:e2e:prod` (**58/58**, con el test del 404 adaptado). Correr también un e2e con `DASHBOARD_SECRET` configurado en los dos lados, para probar el camino del header en local.

## Al terminar

- Actualizar este `CLAUDE.md`: marcar el deploy como hecho en "Orden de trabajo", reemplazar "Pendiente para el deploy" por lo que quedó aceptado (y dónde se documenta), agregar "Decisiones de implementación (deploy)" (IP real, `DASHBOARD_SECRET`, scroll de pestañas, status en producción, URLs de producción) y las variables nuevas en "Tests".
- Actualizar el `CLAUDE.md` de la API (rate limit del registro, guard de IP real, `trust proxy`, scripts `:prod`, `/salud`, `limpiar:e2e`, `PERMITIR_SEED_DEMO`).
- Recordarle al usuario qué quedó sin commitear en cada repo. **Sin commits.**

## Resumen: qué hace el usuario en Railway

1. Crear el proyecto y elegir región (D2).
2. Agregar Postgres; versión y backups (D2).
3. Crear `contable-api` desde GitHub: build, start, pre-deploy, healthcheck, réplicas, variables, dominio (D3).
4. Deployar la API y revisar los logs de migraciones y seed (D4).
5. Crear `contable-dashboard`: build, start, healthcheck, variables, dominio con puerto 3001 (D5).
6. (Opcional) Dominios propios y DNS (D6).
7. (Demo) Crear el cron `demo-reset`, sus variables y "Run now" (D7).
8. Revisar los logs de headers si el rate limit por IP no se comporta como se espera (E7).

Antes de todo eso: commitear y pushear los dos repos (D1).
