import { randomUUID } from 'node:crypto';

import type { Page } from '@playwright/test';

import { formatearCuit } from '../src/lib/cuit';
import { formatearFecha } from '../src/lib/fechas';
import { formatearPeriodo } from '../src/lib/vencimientos';

import { RUTA_SESION_ADMIN } from './env';
import { api, expect, test, tokenDeSesion, type VencimientoApi } from './fixtures';

// Solo leen: usan el admin de demo (sesión de global-setup, sin gastar logins).
// seed:demo arma los vencimientos con fechas relativas a hoy: se compara contra
// la API, nunca contra números fijos.
test.use({ storageState: RUTA_SESION_ADMIN });

const token = () => tokenDeSesion(RUTA_SESION_ADMIN);

interface Paginado {
  data: VencimientoApi[];
  total: number;
}

function vencimientosApi(query: Record<string, string> = {}, ruta = '/vencimientos'): Promise<Paginado> {
  return api<Paginado>(token(), `${ruta}?${new URLSearchParams({ limit: '20', ...query })}`);
}

interface Conteos {
  pendientes: number;
  vencidos: number;
  presentados: number;
  proximos30Dias: number;
}

async function conteosApi(): Promise<Conteos> {
  return (await api<{ vencimientos: Conteos }>(token(), '/estadisticas')).vencimientos;
}

const filas = (page: Page) => page.getByRole('table').locator('tbody tr');
const pestanas = (page: Page) => page.getByRole('navigation', { name: 'Estado' });
const formFiltros = (page: Page) => page.getByRole('search', { name: 'Filtrar vencimientos' });
const resumen = (page: Page) => page.getByTestId('resumen-paginas').filter({ visible: true });

/** Las filas coinciden con la API, en el mismo orden: fecha, cliente, impuesto, período. */
async function esperarFilas(page: Page, vencimientos: VencimientoApi[]) {
  await expect(filas(page)).toHaveCount(vencimientos.length);
  await expect(filas(page).locator('td:nth-child(1)')).toHaveText(
    vencimientos.map((v) => formatearFecha(v.fechaVencimiento)),
  );
  await expect(filas(page).locator('td:nth-child(2)')).toHaveText(vencimientos.map((v) => v.cliente.razonSocial));
  await expect(filas(page).locator('td:nth-child(3)')).toHaveText(vencimientos.map((v) => v.impuesto.nombre));
  await expect(filas(page).locator('td:nth-child(4)')).toHaveText(vencimientos.map((v) => formatearPeriodo(v.periodo)));
}

const plural = (n: number) => `${n} ${n === 1 ? 'vencimiento' : 'vencimientos'}`;

test('navegación: "Vencimientos" es un link y queda activo en el listado y el detalle', async ({ page }) => {
  const { data } = await vencimientosApi({ limit: '1' });
  const nav = page.getByRole('navigation', { name: 'Principal' });
  const link = nav.getByRole('link', { name: 'Vencimientos' });

  await page.goto('/');
  await expect(link).not.toHaveAttribute('aria-current');
  await link.click();
  await expect(page).toHaveURL('/vencimientos');
  await expect(link).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Inicio' })).not.toHaveAttribute('aria-current');

  await page.goto(`/vencimientos/${data[0].id}`);
  await expect(link).toHaveAttribute('aria-current', 'page');
});

test('el listado por defecto es "Pendientes" y coincide con la API', async ({ page }) => {
  const pendientes = await vencimientosApi({ estado: 'pendiente' });
  expect(pendientes.total, 'seed:demo debería tener pendientes').toBeGreaterThan(0);

  await page.goto('/vencimientos');
  await expect(pestanas(page).locator('[aria-current="page"]')).toHaveText(`Pendientes(${pendientes.total})`);
  await esperarFilas(page, pendientes.data);
  await expect(filas(page).locator('td:nth-child(5)')).toHaveText(pendientes.data.map(() => 'Pendiente'));
  // Fechas dd/mm/aaaa.
  await expect(filas(page).first().locator('td').first()).toHaveText(/^\d{2}\/\d{2}\/\d{4}$/);
  await expect(resumen(page)).toContainText(plural(pendientes.total));
});

test('pestañas: cantidades de /estadisticas, Vencidos, Próximos y con un filtro de cliente', async ({ page }) => {
  const c = await conteosApi();
  const todos = c.pendientes + c.vencidos + c.presentados;
  await page.goto('/vencimientos');
  for (const [nombre, n] of [
    ['Vencidos', c.vencidos],
    ['Pendientes', c.pendientes],
    ['Próximos 30 días', c.proximos30Dias],
    ['Presentados', c.presentados],
    ['Todos', todos],
  ] as const) {
    await expect(pestanas(page).getByRole('link', { name: `${nombre}, ${n}` })).toHaveText(`${nombre}(${n})`);
  }

  // Vencidos: seed:demo siempre tiene. Todas las filas dicen "Vencido" y coinciden con la API.
  const vencidos = await vencimientosApi({ estado: 'vencido' });
  expect(vencidos.total).toBeGreaterThan(0);
  await pestanas(page).getByRole('link', { name: /^Vencidos/ }).click();
  await expect(page).toHaveURL('/vencimientos?estado=vencido');
  await esperarFilas(page, vencidos.data);
  await expect(filas(page).locator('td:nth-child(5)')).toHaveText(vencidos.data.map(() => 'Vencido'));
  await expect(pestanas(page).getByRole('link', { name: /^Vencidos/ })).toHaveAttribute('data-destacada', 'true');

  // Próximos 30 días: GET /vencimientos/proximos, sin el formulario de filtros.
  const proximos = await vencimientosApi({}, '/vencimientos/proximos');
  await pestanas(page).getByRole('link', { name: /^Próximos 30 días/ }).click();
  await expect(page).toHaveURL('/vencimientos?estado=proximos');
  await esperarFilas(page, proximos.data);
  await expect(formFiltros(page)).toHaveCount(0);
  await expect(page.getByText('Próximos 30 días de clientes activos.')).toBeVisible();

  // Con un filtro de cliente: sin números, y los links conservan el filtro (salvo Próximos).
  const clienteId = vencidos.data[0].clienteId;
  await page.goto(`/vencimientos?cliente=${clienteId}`);
  await expect(pestanas(page).getByRole('link', { name: 'Vencidos', exact: true })).toHaveAttribute(
    'href',
    `/vencimientos?estado=vencido&cliente=${clienteId}`,
  );
  await expect(pestanas(page).getByRole('link', { name: 'Todos', exact: true })).toHaveAttribute(
    'href',
    `/vencimientos?estado=todos&cliente=${clienteId}`,
  );
  await expect(pestanas(page).getByRole('link', { name: 'Próximos 30 días', exact: true })).toHaveAttribute(
    'href',
    '/vencimientos?estado=proximos',
  );
  await expect(pestanas(page)).not.toContainText('(');
});

test('filtro por cliente y por impuesto: la URL los refleja y las filas coinciden con la API', async ({
  page,
}) => {
  const { data: todos } = await vencimientosApi();
  const { cliente, impuesto } = todos[0];

  await page.goto('/vencimientos?estado=todos');
  await formFiltros(page).getByLabel('Cliente').selectOption({ label: cliente.razonSocial });
  await formFiltros(page).getByRole('button', { name: 'Buscar' }).click();
  await expect(page).toHaveURL(`/vencimientos?estado=todos&cliente=${cliente.id}`);
  await esperarFilas(page, (await vencimientosApi({ clienteId: cliente.id })).data);

  await formFiltros(page).getByLabel('Impuesto').selectOption({ label: impuesto.nombre });
  await formFiltros(page).getByRole('button', { name: 'Buscar' }).click();
  await expect(page).toHaveURL(`/vencimientos?estado=todos&cliente=${cliente.id}&impuesto=${impuesto.id}`);
  await esperarFilas(page, (await vencimientosApi({ clienteId: cliente.id, impuestoId: impuesto.id })).data);
  // Los filtros quedan elegidos.
  await expect(formFiltros(page).getByLabel('Cliente')).toHaveValue(cliente.id);

  // "Limpiar" saca los filtros y se queda en la pestaña.
  await formFiltros(page).getByRole('link', { name: 'Limpiar' }).click();
  await expect(page).toHaveURL('/vencimientos?estado=todos');
});

test('rango de fechas: filtra como la API; desde > hasta muestra el aviso y "Limpiar" vuelve', async ({
  page,
}) => {
  const { data } = await vencimientosApi({ limit: '100' });
  const desde = data[0].fechaVencimiento;
  const hasta = data[Math.min(5, data.length - 1)].fechaVencimiento;

  await page.goto('/vencimientos?estado=todos');
  await formFiltros(page).getByLabel('Desde').fill(desde);
  await formFiltros(page).getByLabel('Hasta').fill(hasta);
  await formFiltros(page).getByRole('button', { name: 'Buscar' }).click();
  await expect(page).toHaveURL(`/vencimientos?estado=todos&desde=${desde}&hasta=${hasta}`);
  await esperarFilas(page, (await vencimientosApi({ desde, hasta })).data);

  await page.goto(`/vencimientos?estado=todos&desde=${hasta}&hasta=${desde}`);
  if (desde !== hasta) {
    const alerta = page.getByRole('alert').filter({ hasText: 'Revisá las fechas' });
    await expect(alerta).toContainText('"Desde" no puede ser posterior a "Hasta"');
    await expect(page.getByRole('table')).toHaveCount(0);
    // El formulario queda con lo pedido.
    await expect(formFiltros(page).getByLabel('Desde')).toHaveValue(hasta);
    await alerta.getByRole('link', { name: 'Limpiar' }).click();
    await expect(page).toHaveURL('/vencimientos?estado=todos');
    await expect(filas(page).first()).toBeVisible();
  }

  await page.goto('/vencimientos?desde=2026-02-30');
  await expect(page.getByRole('alert').filter({ hasText: 'Revisá las fechas' })).toContainText(
    '"Desde" no es una fecha válida',
  );
});

test('detalle: datos del vencimiento; un id inexistente o que no es UUID da "no encontrado"', async ({
  page,
}) => {
  const [v] = (await vencimientosApi({ estado: 'presentado', limit: '1' })).data;
  await page.goto('/vencimientos?estado=presentado');
  await filas(page).first().getByRole('link').click();
  await expect(page).toHaveURL(`/vencimientos/${v.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    `${v.impuesto.nombre} · ${formatearPeriodo(v.periodo)}`,
  );
  await expect(page.getByTestId('estado-vencimiento').filter({ visible: true })).toHaveText('Presentado');
  const datos = page.getByTestId('datos-vencimiento').filter({ visible: true });
  await expect(datos).toContainText(v.cliente.razonSocial);
  await expect(datos).toContainText(formatearCuit(v.cliente.cuit));
  await expect(datos).toContainText(`Fecha de vencimiento${formatearFecha(v.fechaVencimiento)}`);
  await expect(datos).toContainText(`Fecha de presentación${formatearFecha(v.fechaPresentacion)}`);
  await expect(page.getByTestId('presentado-el')).toHaveText(`Presentado el ${formatearFecha(v.fechaPresentacion)}`);

  for (const id of [randomUUID(), 'no-es-uuid']) {
    await page.goto(`/vencimientos/${id}`);
    await expect(page.getByRole('heading', { name: 'Vencimiento no encontrado' })).toBeVisible();
  }
});

test.describe('en el celular', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('el listado va en tarjetas, sin scroll horizontal de la página', async ({ page }) => {
    const pendientes = await vencimientosApi({ estado: 'pendiente' });
    await page.goto('/vencimientos');
    await expect(page.getByRole('table')).toBeHidden();
    const tarjetas = page.getByTestId('tarjetas-vencimientos').filter({ visible: true }).locator('li');
    await expect(tarjetas).toHaveCount(pendientes.data.length);
    await expect(tarjetas.first()).toContainText(formatearFecha(pendientes.data[0].fechaVencimiento));
    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(desborde).toBeLessThanOrEqual(0);
    // Las pestañas entran o hacen scroll dentro de su contenedor.
    const pestana = pestanas(page).getByRole('link', { name: /^Todos/ });
    await pestana.scrollIntoViewIfNeeded();
    await expect(pestana).toBeInViewport();
  });

  test('la pestaña activa queda a la vista sin mover la página, al entrar y al cambiar de pestaña', async ({
    page,
  }) => {
    await page.goto('/vencimientos?estado=todos');
    await expect.poll(() => activaDentroDeLaNav(page)).toBe(true);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    // Cambio de pestaña sin volver a montar la nav: se vuelve al principio a mano y
    // se hace click con dispatchEvent, que no hace scroll (click() sí lo haría).
    await page.getByRole('link', { name: /^Pendientes/ }).click();
    await expect(page).toHaveURL('/vencimientos');
    await pestanas(page).evaluate((nav) => (nav.scrollLeft = 0));
    const todos = pestanas(page).getByRole('link', { name: /^Todos/ });
    expect(await activaDentroDeLaNav(page, todos)).toBe(false);
    await todos.dispatchEvent('click');
    await expect(page).toHaveURL('/vencimientos?estado=todos');
    await expect(todos).toHaveAttribute('aria-current', 'page');
    await expect.poll(() => activaDentroDeLaNav(page)).toBe(true);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });
});

test('en el escritorio, la nav de pestañas no se mueve', async ({ page }) => {
  await page.goto('/vencimientos?estado=todos');
  await expect(pestanas(page).locator('[aria-current="page"]')).toBeVisible();
  expect(await pestanas(page).evaluate((nav) => nav.scrollLeft)).toBe(0);
});

/** Si la pestaña (por defecto, la activa) se ve entera dentro de la nav. */
async function activaDentroDeLaNav(page: Page, pestana = pestanas(page).locator('[aria-current="page"]')) {
  const [nav, link] = await Promise.all([pestanas(page).boundingBox(), pestana.boundingBox()]);
  if (!nav || !link) return false;
  return link.x >= nav.x - 0.5 && link.x + link.width <= nav.x + nav.width + 0.5;
}

test('tarjetas del Inicio: cada una lleva a su destino y coincide con el listado', async ({ page }) => {
  const c = await conteosApi();
  const destinos = [
    ['Ver clientes', '/clientes'],
    ['Ver pendientes', '/vencimientos'],
    ['Ver vencidos', '/vencimientos?estado=vencido'],
    ['Ver presentados', '/vencimientos?estado=presentado'],
    ['Ver próximos 30 días', '/vencimientos?estado=proximos'],
  ] as const;
  for (const [nombre, destino] of destinos) {
    await page.goto('/');
    await page.getByRole('link', { name: nombre }).click();
    await expect(page).toHaveURL(destino);
  }

  for (const [tarjeta, pestana, n] of [
    ['proximos', 'Próximos 30 días', c.proximos30Dias],
    ['vencidos', 'Vencidos', c.vencidos],
  ] as const) {
    await page.goto('/');
    const valor = await page.getByTestId(`tarjeta-${tarjeta}`).getByTestId('valor').textContent();
    expect(Number(valor)).toBe(n);
    await page.getByTestId(`tarjeta-${tarjeta}`).click();
    await expect(pestanas(page).locator('[aria-current="page"]')).toHaveText(`${pestana}(${n})`);
    await expect(resumen(page)).toContainText(`· ${plural(n)}`);
  }
});
