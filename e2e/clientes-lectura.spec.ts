import { randomUUID } from 'node:crypto';

import type { Page } from '@playwright/test';

import { formatearCuit } from '../src/lib/cuit';

import { RUTA_SESION_ADMIN } from './env';
import { api, env, expect, test, tokenDeSesion, type ClienteApi } from './fixtures';

// Solo leen: usan el admin de demo (sesión de global-setup, sin gastar logins).
// Los datos de seed:demo se comparan contra la API, no contra valores fijos.
test.use({ storageState: RUTA_SESION_ADMIN });

async function clientesDeLaApi(query: Record<string, string>): Promise<ClienteApi[]> {
  const qs = new URLSearchParams({ limit: '100', ...query });
  const { data } = await api<{ data: ClienteApi[] }>(
    tokenDeSesion(RUTA_SESION_ADMIN),
    `/clientes?${qs}`,
  );
  return data;
}

const filas = (page: Page) => page.getByRole('table').locator('tbody tr');

/** Las razones sociales de la tabla coinciden (mismo orden) con las de la API. */
async function esperarTabla(page: Page, clientes: ClienteApi[]) {
  await expect(filas(page)).toHaveCount(clientes.length);
  await expect(filas(page).locator('td:first-child')).toHaveText(clientes.map((c) => c.razonSocial));
}

test('barra de navegación: link activo, Vencimientos como link, saludo y Cerrar sesión', async ({
  page,
}) => {
  const [cliente] = await clientesDeLaApi({ activo: 'true' });
  const nav = page.getByRole('navigation', { name: 'Principal' });
  const inicio = nav.getByRole('link', { name: 'Inicio' });
  const clientes = nav.getByRole('link', { name: 'Clientes' });

  await page.goto('/');
  await expect(inicio).toHaveAttribute('aria-current', 'page');
  await expect(clientes).not.toHaveAttribute('aria-current');

  await page.goto('/clientes');
  await expect(clientes).toHaveAttribute('aria-current', 'page');
  await expect(inicio).not.toHaveAttribute('aria-current');

  await page.goto(`/clientes/${cliente.id}`);
  await expect(clientes).toHaveAttribute('aria-current', 'page');

  // Paso 4: "Vencimientos" ya es un link (el detalle está en vencimientos-lectura.spec).
  const vencimientos = nav.getByRole('link', { name: 'Vencimientos' });
  await expect(vencimientos).toHaveAttribute('href', '/vencimientos');
  await expect(vencimientos).not.toHaveAttribute('aria-current');
  await expect(nav.getByText('Próximamente')).toHaveCount(0);

  const banner = page.getByRole('banner');
  await expect(banner.getByText(`Hola, ${env.E2E_ADMIN_NOMBRE}`)).toBeVisible();
  await expect(banner.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
});

test('el listado por defecto muestra los activos de la API, con el CUIT formateado', async ({
  page,
}) => {
  const activos = await clientesDeLaApi({ activo: 'true' });
  expect(activos.length, 'seed:demo debería tener clientes activos').toBeGreaterThan(0);

  await page.goto('/clientes');
  await expect(page.getByLabel('Estado')).toHaveValue('activos');
  await esperarTabla(page, activos);
  await expect(filas(page).first()).toContainText(formatearCuit(activos[0].cuit));
  await expect(page.getByTestId('resumen-paginas')).toHaveText(
    `Página 1 de 1 · ${activos.length} ${activos.length === 1 ? 'cliente' : 'clientes'}`,
  );
});

test('busca por razón social y por CUIT con guiones; la URL refleja `buscar`', async ({ page }) => {
  const activos = await clientesDeLaApi({ activo: 'true' });
  const objetivo = activos.at(-1)!;
  // Un fragmento del medio de la razón social, en minúsculas.
  const fragmento = objetivo.razonSocial.slice(1, 6).toLowerCase();
  const porNombre = await clientesDeLaApi({ activo: 'true', search: fragmento });
  expect(porNombre.map((c) => c.id)).toContain(objetivo.id);

  await page.goto('/clientes');
  await page.getByLabel('Razón social o CUIT').fill(fragmento);
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page).toHaveURL(`/clientes?buscar=${encodeURIComponent(fragmento).replaceAll('%20', '+')}`);
  await esperarTabla(page, porNombre);

  const cuit = formatearCuit(objetivo.cuit);
  const porCuit = await clientesDeLaApi({ activo: 'true', search: cuit });
  await page.getByLabel('Razón social o CUIT').fill(cuit);
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page).toHaveURL(`/clientes?buscar=${cuit}`);
  await esperarTabla(page, porCuit);
  await expect(filas(page).first()).toContainText(objetivo.razonSocial);

  // "Limpiar" vuelve al listado por defecto.
  await page.getByRole('link', { name: 'Limpiar' }).click();
  await expect(page).toHaveURL(/\/clientes$/);
  await expect(page.getByLabel('Razón social o CUIT')).toHaveValue('');
  await esperarTabla(page, activos);
});

test('el filtro "Dados de baja" muestra el inactivo de demo y no los activos', async ({ page }) => {
  const [inactivos, activos] = await Promise.all([
    clientesDeLaApi({ activo: 'false' }),
    clientesDeLaApi({ activo: 'true' }),
  ]);
  expect(inactivos.length, 'seed:demo debería tener un cliente dado de baja').toBeGreaterThan(0);

  await page.goto('/clientes');
  await page.getByLabel('Estado').selectOption('baja');
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page).toHaveURL('/clientes?estado=baja');
  await esperarTabla(page, inactivos);
  await expect(filas(page).first()).toContainText('Dado de baja');
  for (const c of activos) {
    await expect(page.getByRole('table').getByText(c.razonSocial, { exact: true })).toHaveCount(0);
  }
});

test('un id inexistente o que no es UUID muestra "Cliente no encontrado"', async ({ page }) => {
  for (const id of [randomUUID(), 'no-es-uuid']) {
    const respuesta = await page.goto(`/clientes/${id}`);
    expect(respuesta?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: 'Cliente no encontrado' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Volver a Clientes' })).toHaveAttribute('href', '/clientes');
  }
});

test.describe('en el celular', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('el listado va en tarjetas, sin scroll horizontal, y la barra entra en el ancho', async ({
    page,
  }) => {
    const activos = await clientesDeLaApi({ activo: 'true' });
    await page.goto('/clientes');

    await expect(page.getByRole('table')).toBeHidden();
    const tarjetas = page.getByTestId('tarjetas-clientes').locator('li');
    await expect(tarjetas).toHaveCount(activos.length);
    await expect(tarjetas.first()).toContainText(activos[0].razonSocial);
    await expect(tarjetas.first()).toContainText(formatearCuit(activos[0].cuit));

    const nav = (await page.getByRole('navigation', { name: 'Principal' }).boundingBox())!;
    expect(nav.x).toBeGreaterThanOrEqual(0);
    expect(nav.x + nav.width).toBeLessThanOrEqual(390);
    // Los links bajan a una segunda fila, debajo del saludo.
    const saludo = (await page.getByRole('banner').getByText(/^Hola, /).boundingBox())!;
    expect(nav.y).toBeGreaterThan(saludo.y);

    const desborda = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(desborda).toBe(false);
  });
});
