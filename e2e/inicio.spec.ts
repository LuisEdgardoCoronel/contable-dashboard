import type { Page } from '@playwright/test';

import { RUTA_SESION_ADMIN } from './env';
import { env, expect, test, tokenDeSesion } from './fixtures';

// Reusa la sesión de global-setup: no gasta intentos del rate limit del login.
test.use({ storageState: RUTA_SESION_ADMIN });

interface Conteos {
  pendientes: number;
  vencidos: number;
  presentados: number;
}
interface EstadisticasApi {
  hoy: string;
  rango: { desde: string; hasta: string };
  clientes: { activos: number; inactivos: number };
  vencimientos: Conteos & { proximos30Dias: number };
  porMes: (Conteos & { mes: string })[];
  porImpuesto: (Conteos & { impuesto: { nombre: string } })[];
}

/**
 * Lo que devuelve la API, pedido desde Node (no desde el navegador). Los datos
 * de seed:demo dependen de la fecha de hoy, así que se comparan contra la API
 * en vez de fijarlos en el test.
 */
async function estadisticasDeLaApi(query: Record<string, string> = {}): Promise<EstadisticasApi> {
  const url = new URL('/estadisticas', env.E2E_API_URL);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const r = await fetch(url, { headers: { Authorization: `Bearer ${tokenDeSesion(RUTA_SESION_ADMIN)}` } });
  if (!r.ok) throw new Error(`GET /estadisticas → ${r.status}`);
  return (await r.json()) as EstadisticasApi;
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** `2026-06-01` → `01/06/2026`. */
const ddmmaaaa = (f: string) => f.split('-').reverse().join('/');

const valor = (page: Page, tarjeta: string) =>
  page.getByTestId(`tarjeta-${tarjeta}`).getByTestId('valor');

const hayDatos = (puntos: Conteos[]) =>
  puntos.some((p) => p.pendientes + p.vencidos + p.presentados > 0);

test('las tarjetas muestran los totales de la API, con la fecha de corte y el rango', async ({
  page,
}) => {
  const api = await estadisticasDeLaApi();
  await page.goto('/');

  await expect(valor(page, 'clientes')).toHaveText(String(api.clientes.activos));
  await expect(page.getByTestId('tarjeta-clientes')).toContainText(
    `${api.clientes.inactivos} ${api.clientes.inactivos === 1 ? 'dado' : 'dados'} de baja`,
  );
  await expect(valor(page, 'pendientes')).toHaveText(String(api.vencimientos.pendientes));
  await expect(valor(page, 'vencidos')).toHaveText(String(api.vencimientos.vencidos));
  // Con al menos un vencido, la tarjeta va en rojo (el caso 0 lo cubre registro.spec).
  if (api.vencimientos.vencidos > 0) {
    await expect(page.getByTestId('tarjeta-vencidos')).toHaveAttribute('data-destacada', 'true');
  }
  await expect(valor(page, 'presentados')).toHaveText(String(api.vencimientos.presentados));
  await expect(valor(page, 'proximos')).toHaveText(String(api.vencimientos.proximos30Dias));

  await expect(page.getByTestId('tarjeta-pendientes')).toContainText('Pendientes (al día)');

  const [aaaa, mm, dd] = api.hoy.split('-');
  await expect(page.getByTestId('fecha-corte')).toHaveText(
    `Datos al ${Number(dd)} de ${MESES[Number(mm) - 1]} de ${aaaa}`,
  );
  await expect(page.getByTestId('rango-aplicado')).toHaveText(
    `Rango: ${ddmmaaaa(api.rango.desde)} – ${ddmmaaaa(api.rango.hasta)}`,
  );
});

test('los gráficos se renderizan con leyenda en texto y tooltip con números', async ({ page }) => {
  const api = await estadisticasDeLaApi();
  // seed:demo tiene vencimientos en el rango por defecto; si no, el test no prueba nada.
  expect(hayDatos(api.porMes), 'seed:demo debería tener vencimientos en el rango').toBe(true);
  await page.goto('/');

  for (const id of ['grafico-por-mes', 'grafico-por-impuesto']) {
    const panel = page.getByTestId(id);
    await expect(panel.locator('svg.recharts-surface').first()).toBeVisible();
    for (const etiqueta of ['Pendientes (al día)', 'Vencidos', 'Presentados']) {
      await expect(panel.getByText(etiqueta, { exact: true })).toBeVisible();
    }
  }

  // Un impuesto de la API aparece en el eje.
  await expect(
    page.getByTestId('grafico-por-impuesto').getByText(api.porImpuesto[0].impuesto.nombre).first(),
  ).toBeVisible();

  // Hover sobre el último mes: el tooltip muestra el mes completo y los tres números.
  const ultimo = api.porMes.at(-1)!;
  const grafico = page.getByTestId('grafico-por-mes').locator('.recharts-wrapper');
  // `mouse.move` usa coordenadas de la ventana: el gráfico tiene que estar a la vista
  // (a 1280×720 su mitad queda debajo del borde).
  await grafico.scrollIntoViewIfNeeded();
  const caja = (await grafico.boundingBox())!;
  await page.mouse.move(caja.x + caja.width - 30, caja.y + caja.height / 2);
  const tooltip = page.getByTestId('grafico-por-mes').locator('.recharts-tooltip-wrapper');
  await expect(tooltip).toContainText(`Vencidos${ultimo.vencidos}`);
  await expect(tooltip).toContainText(`Presentados${ultimo.presentados}`);
  await expect(tooltip).toContainText(`Pendientes (al día)${ultimo.pendientes}`);
});

test('aplicar un rango cambia los gráficos; el botón dice "Aplicando…" mientras carga', async ({
  page,
}) => {
  const base = await estadisticasDeLaApi();
  const anio = base.hoy.slice(0, 4);
  const desde = `${anio}-01-01`;
  const hasta = `${anio}-03-31`;
  const api = await estadisticasDeLaApi({ desde, hasta });

  await page.goto('/');
  await page.getByLabel('Desde').fill(desde);
  await page.getByLabel('Hasta').fill(hasta);

  // Demora la navegación (el payload RSC que pide el navegador a Next) para ver el estado pendiente.
  let liberar!: () => void;
  let interceptada = false;
  const demora = new Promise<void>((r) => (liberar = r));
  await page.route(
    (url) => url.searchParams.has('_rsc') && url.searchParams.get('desde') === desde,
    async (ruta) => {
      interceptada = true;
      await demora;
      await ruta.continue();
    },
  );

  await page.getByRole('button', { name: 'Aplicar' }).click();
  const aplicando = page.getByRole('button', { name: 'Aplicando…' });
  await expect(aplicando).toBeVisible();
  await expect(aplicando).toBeDisabled();
  // Sin esto el test podría pasar sin haber demorado nada.
  expect(interceptada, 'la navegación debería pedir el payload RSC').toBe(true);
  liberar();

  await expect(page).toHaveURL(`/?desde=${desde}&hasta=${hasta}`);
  await expect(page.getByTestId('rango-aplicado')).toHaveText(
    `Rango: ${ddmmaaaa(api.rango.desde)} – ${ddmmaaaa(api.rango.hasta)}`,
  );
  await expect(page.getByRole('button', { name: 'Aplicar' })).toBeEnabled();
  // Las tarjetas no dependen del rango.
  await expect(valor(page, 'vencidos')).toHaveText(String(base.vencimientos.vencidos));
});

test.describe('sin JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('el formulario del rango funciona como un GET común', async ({ page }) => {
    const base = await estadisticasDeLaApi();
    const anio = base.hoy.slice(0, 4);
    await page.goto('/');
    await page.getByLabel('Desde').fill(`${anio}-02-01`);
    await page.getByLabel('Hasta').fill(`${anio}-02-28`);
    await page.getByRole('button', { name: 'Aplicar' }).click();

    await expect(page).toHaveURL(`/?desde=${anio}-02-01&hasta=${anio}-02-28`);
    await expect(page.getByTestId('rango-aplicado')).toHaveText(
      `Rango: 01/02/${anio} – 28/02/${anio}`,
    );
  });
});

test('un rango inválido muestra el mensaje de la API y "Restablecer" vuelve al default', async ({
  page,
}) => {
  const api = await estadisticasDeLaApi();
  await page.goto('/?desde=2026-05-01&hasta=2026-01-01');

  const alerta = page.getByRole('alert').filter({ hasText: 'No se pudo aplicar el rango' });
  await expect(alerta).toBeVisible();
  await expect(alerta.getByTestId('mensaje-api')).not.toBeEmpty();
  // El formulario conserva lo que se pidió, para corregirlo.
  await expect(page.getByLabel('Desde')).toHaveValue('2026-05-01');

  await page.getByRole('link', { name: 'Restablecer' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByTestId('rango-aplicado')).toHaveText(
    `Rango: ${ddmmaaaa(api.rango.desde)} – ${ddmmaaaa(api.rango.hasta)}`,
  );
  await expect(page.getByLabel('Desde')).toHaveValue(api.rango.desde);
});

test.describe('en el celular', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('tarjetas en una columna y gráficos a ancho completo, sin scroll horizontal', async ({
    page,
  }) => {
    await page.goto('/');
    const ids = ['clientes', 'pendientes', 'vencidos', 'presentados', 'proximos'];
    const cajas = await Promise.all(
      ids.map(async (id) => (await page.getByTestId(`tarjeta-${id}`).boundingBox())!),
    );
    // Misma columna: mismo x y cada una debajo de la anterior.
    for (let i = 1; i < cajas.length; i++) {
      expect(cajas[i].x).toBeCloseTo(cajas[0].x, 0);
      expect(cajas[i].y).toBeGreaterThan(cajas[i - 1].y);
    }

    const tarjeta = cajas[0];
    for (const id of ['grafico-por-mes', 'grafico-por-impuesto']) {
      const caja = (await page.getByTestId(id).boundingBox())!;
      expect(caja.x).toBeCloseTo(tarjeta.x, 0);
      expect(caja.width).toBeCloseTo(tarjeta.width, 0);
    }

    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(desborda).toBe(false);
  });
});
