import type { Page } from '@playwright/test';

import { formatearFecha } from '../src/lib/fechas';

import { RUTA_SESION_PROPIA } from './env';
import {
  api,
  crearClienteApi,
  crearVencimientoApi,
  expect,
  fechaRelativa,
  impuestoApi,
  sufijoUnico,
  test,
  tokenDeSesion,
  type ClienteApi,
  type VencimientoApi,
} from './fixtures';

// Crean, modifican y borran: usan el admin propio que registra global-setup.
// Cada test crea su propio cliente, así no choca con el índice único
// (cliente, impuesto, período) ni depende de otra corrida.
test.use({ storageState: RUTA_SESION_PROPIA });

const token = () => tokenDeSesion(RUTA_SESION_PROPIA);

const URL_DETALLE = /\/vencimientos\/[0-9a-f-]{36}\?ok=creado$/;

const nuevoCliente = (nombre: string) => crearClienteApi(token(), { razonSocial: `E2E ${nombre} ${sufijoUnico()}` });

async function vencimientosDe(clienteId: string): Promise<VencimientoApi[]> {
  const qs = new URLSearchParams({ clienteId, limit: '100' });
  return (await api<{ data: VencimientoApi[] }>(token(), `/vencimientos?${qs}`)).data;
}

/** Campos del alta. Visibles: después de navegar, el listado (con su propio "Cliente") puede seguir oculto en el DOM. */
const campo = (page: Page, etiqueta: string) => page.getByLabel(etiqueta, { exact: true }).filter({ visible: true });

async function completarAlta(
  page: Page,
  datos: { cliente: ClienteApi; impuesto: string; fecha: string; periodo: string; notas?: string },
) {
  await campo(page, 'Cliente').selectOption({ label: datos.cliente.razonSocial });
  await campo(page, 'Impuesto').selectOption({ label: datos.impuesto });
  await campo(page, 'Fecha de vencimiento').fill(datos.fecha);
  await campo(page, 'Período').fill(datos.periodo);
  if (datos.notas !== undefined) await campo(page, 'Notas (opcional)').fill(datos.notas);
}

// Next 16 conserva las rutas visitadas ocultas en el DOM: los helpers filtran por visibles.
const aviso = (page: Page) => page.getByRole('status').filter({ visible: true });
const estado = (page: Page) => page.getByTestId('estado-vencimiento').filter({ visible: true });
const datos = (page: Page) => page.getByTestId('datos-vencimiento').filter({ visible: true });
const filas = (page: Page) => page.getByRole('table').locator('tbody tr');

test('alta: lleva al detalle con "Vencimiento creado" y aparece en el listado del cliente', async ({
  page,
}) => {
  const cliente = await nuevoCliente('Alta venc');
  const fecha = fechaRelativa(20);
  await page.goto('/vencimientos');
  await page.getByRole('link', { name: 'Nuevo vencimiento' }).first().click();
  await expect(page).toHaveURL('/vencimientos/nuevo');

  await completarAlta(page, { cliente, impuesto: 'IVA (mensual)', fecha, periodo: '2026-10', notas: 'Pedir facturas' });
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page).toHaveURL(URL_DETALLE);
  await expect(aviso(page)).toContainText('Vencimiento creado');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('IVA · octubre 2026');
  await expect(estado(page)).toHaveText('Pendiente');
  await expect(datos(page)).toContainText(cliente.razonSocial);
  await expect(datos(page)).toContainText(`Fecha de vencimiento${formatearFecha(fecha)}`);
  await expect(datos(page)).toContainText('NotasPedir facturas');

  await page.goto(`/vencimientos?cliente=${cliente.id}`);
  await expect(filas(page)).toHaveCount(1);
  await expect(filas(page).first()).toContainText(cliente.razonSocial);
});

test('período contra la periodicidad: error sin llamar a la API, valores conservados y ayuda dinámica', async ({
  page,
}) => {
  const cliente = await nuevoCliente('Periodo');
  await page.goto('/vencimientos/nuevo');
  const periodo = campo(page, 'Período');
  const ayuda = page.locator('#periodo-ayuda');
  await expect(ayuda).toHaveText(
    'AAAA-MM para impuestos mensuales (por ejemplo, 2026-10), AAAA para anuales (por ejemplo, 2025)',
  );

  await campo(page, 'Impuesto').selectOption({ label: 'Ganancias (anual)' });
  await expect(ayuda).toHaveText('Formato AAAA, por ejemplo 2025');
  await expect(periodo).toHaveAttribute('placeholder', '2025');
  await campo(page, 'Impuesto').selectOption({ label: 'IVA (mensual)' });
  await expect(ayuda).toHaveText('Formato AAAA-MM, por ejemplo 2026-10');
  await expect(periodo).toHaveAttribute('placeholder', '2026-10');

  await completarAlta(page, { cliente, impuesto: 'Ganancias (anual)', fecha: fechaRelativa(30), periodo: '2026-10' });
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page.locator('#periodo-error')).toHaveText('Para Ganancias el período es AAAA (por ejemplo, 2025)');
  await expect(periodo).toHaveAttribute('aria-invalid', 'true');
  await expect(periodo).toHaveAttribute('aria-describedby', 'periodo-ayuda periodo-error');
  await expect(page).toHaveURL('/vencimientos/nuevo');
  await expect(periodo).toHaveValue('2026-10');
  await expect(campo(page, 'Cliente')).toHaveValue(cliente.id);
  await expect(ayuda).toHaveText('Formato AAAA, por ejemplo 2025');
  expect(await vencimientosDe(cliente.id)).toEqual([]);
});

test('un vencimiento repetido muestra el 409 de la API en el campo período', async ({ page }) => {
  const cliente = await nuevoCliente('Duplicado');
  const iva = await impuestoApi(token(), 'IVA');
  await crearVencimientoApi(token(), {
    clienteId: cliente.id,
    impuestoId: iva.id,
    fechaVencimiento: fechaRelativa(15),
    periodo: '2026-09',
  });

  await page.goto('/vencimientos/nuevo');
  await completarAlta(page, { cliente, impuesto: 'IVA (mensual)', fecha: fechaRelativa(16), periodo: '2026-09' });
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page.locator('#periodo-error')).toHaveText(
    'Ya existe un vencimiento de ese impuesto para ese cliente y período',
  );
  await expect(page).toHaveURL('/vencimientos/nuevo');
  expect(await vencimientosDe(cliente.id)).toHaveLength(1);
});

test('un cliente dado de baja no aparece en el alta', async ({ page }) => {
  const activo = await nuevoCliente('Activo');
  const deBaja = await nuevoCliente('De baja');
  await api(token(), `/clientes/${deBaja.id}`, { method: 'DELETE' });

  await page.goto('/vencimientos/nuevo');
  const select = campo(page, 'Cliente');
  await expect(select.locator('option', { hasText: activo.razonSocial })).toHaveCount(1);
  await expect(select.locator('option', { hasText: deBaja.razonSocial })).toHaveCount(0);

  // En el filtro del listado sí está, marcado.
  await page.goto('/vencimientos?estado=todos');
  await expect(
    page.getByRole('search').getByLabel('Cliente').locator('option', { hasText: deBaja.razonSocial }),
  ).toHaveText(`${deBaja.razonSocial} (dado de baja)`);
});

test.describe('sin JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  // Solo el caso exitoso: los errores sin JS no se ven en producción (ver CLAUDE.md).
  test('el alta funciona y llega al detalle; la ayuda del período es la general', async ({ page }) => {
    const cliente = await nuevoCliente('SinJS venc');
    await page.goto('/vencimientos/nuevo');
    await completarAlta(page, { cliente, impuesto: 'Ganancias (anual)', fecha: fechaRelativa(40), periodo: '2025' });
    await expect(page.locator('#periodo-ayuda')).toHaveText(
      'AAAA-MM para impuestos mensuales (por ejemplo, 2026-10), AAAA para anuales (por ejemplo, 2025)',
    );
    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(page).toHaveURL(URL_DETALLE);
    await expect(aviso(page)).toContainText('Vencimiento creado');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ganancias · 2025');
  });
});

test('con la fecha pasada, se ve "Vencido" en el listado y en el detalle', async ({ page }) => {
  const cliente = await nuevoCliente('Vencido');
  const iva = await impuestoApi(token(), 'IVA');
  const v = await crearVencimientoApi(token(), {
    clienteId: cliente.id,
    impuestoId: iva.id,
    fechaVencimiento: fechaRelativa(-3),
    periodo: '2026-08',
  });

  await page.goto(`/vencimientos?estado=vencido&cliente=${cliente.id}`);
  await expect(filas(page)).toHaveCount(1);
  await expect(filas(page).first().locator('td:nth-child(5)')).toHaveText('Vencido');
  await filas(page).first().getByRole('link').click();
  await expect(page).toHaveURL(`/vencimientos/${v.id}`);
  await expect(estado(page)).toHaveText('Vencido');
});

test('marcar como presentado (fecha pasada y futura) y volver a pendiente', async ({ page }) => {
  const cliente = await nuevoCliente('Presentado');
  const iva = await impuestoApi(token(), 'IVA');
  const v = await crearVencimientoApi(token(), {
    clienteId: cliente.id,
    impuestoId: iva.id,
    fechaVencimiento: fechaRelativa(5),
    periodo: '2026-07',
  });
  const detalle = `/vencimientos/${v.id}`;
  const fechaPresentacion = page.getByLabel('Fecha de presentación');

  await page.goto(detalle);
  await fechaPresentacion.fill(fechaRelativa(2));
  await page.getByRole('button', { name: 'Marcar como presentado' }).click();
  await expect(page.locator('#fechaPresentacion-error')).toHaveText('La fecha de presentación no puede ser futura');
  await expect(fechaPresentacion).toHaveValue(fechaRelativa(2));
  expect((await api<VencimientoApi>(token(), detalle)).estado).toBe('pendiente');

  const pasada = fechaRelativa(-1);
  await fechaPresentacion.fill(pasada);
  await page.getByRole('button', { name: 'Marcar como presentado' }).click();
  await expect(page).toHaveURL(`${detalle}?ok=presentado`);
  await expect(aviso(page)).toContainText('Marcado como presentado');
  await expect(estado(page)).toHaveText('Presentado');
  await expect(page.getByTestId('presentado-el')).toHaveText(`Presentado el ${formatearFecha(pasada)}`);
  expect(await api<VencimientoApi>(token(), detalle)).toMatchObject({ estado: 'presentado', fechaPresentacion: pasada });

  await page.getByRole('button', { name: 'Volver a pendiente' }).click();
  await expect(page).toHaveURL(`${detalle}?ok=pendiente`);
  await expect(aviso(page)).toContainText('Volvió a pendiente');
  await expect(estado(page)).toHaveText('Pendiente');
  await expect(datos(page)).toContainText('Fecha de presentación—');
  expect(await api<VencimientoApi>(token(), detalle)).toMatchObject({ estado: 'pendiente', fechaPresentacion: null });
});

test('notas: guardar y borrar', async ({ page }) => {
  const cliente = await nuevoCliente('Notas');
  const iva = await impuestoApi(token(), 'IVA');
  const v = await crearVencimientoApi(token(), {
    clienteId: cliente.id,
    impuestoId: iva.id,
    fechaVencimiento: fechaRelativa(8),
    periodo: '2026-06',
  });
  const detalle = `/vencimientos/${v.id}`;
  const notas = page.getByLabel('Notas', { exact: true });

  await page.goto(detalle);
  await expect(datos(page)).toContainText('NotasSin notas');
  await notas.fill('Falta el F.931');
  await page.getByRole('button', { name: 'Guardar notas' }).click();
  await expect(page).toHaveURL(`${detalle}?ok=notas`);
  await expect(aviso(page)).toContainText('Notas guardadas');
  await expect(datos(page)).toContainText('NotasFalta el F.931');
  await expect(notas).toHaveValue('Falta el F.931');
  expect((await api<VencimientoApi>(token(), detalle)).notas).toBe('Falta el F.931');

  await notas.fill('');
  await page.getByRole('button', { name: 'Guardar notas' }).click();
  await expect(datos(page)).toContainText('NotasSin notas');
  await expect(notas).toHaveValue('');
  expect((await api<VencimientoApi>(token(), detalle)).notas).toBeNull();
});

test('borrar con confirmación', async ({ page }) => {
  const cliente = await nuevoCliente('Borrar');
  const iva = await impuestoApi(token(), 'IVA');
  const v = await crearVencimientoApi(token(), {
    clienteId: cliente.id,
    impuestoId: iva.id,
    fechaVencimiento: fechaRelativa(9),
    periodo: '2026-05',
  });
  const detalle = `/vencimientos/${v.id}`;
  const confirmacion = page.getByTestId('confirmar-borrado');

  await page.goto(detalle);
  await page.getByRole('link', { name: 'Borrar', exact: true }).click();
  await expect(page).toHaveURL(`${detalle}?confirmar=borrar`);
  await expect(confirmacion).toContainText(
    `¿Borrar el vencimiento de IVA mayo 2026 de ${cliente.razonSocial}? No se puede deshacer.`,
  );
  await confirmacion.getByRole('link', { name: 'Cancelar' }).click();
  await expect(page).toHaveURL(detalle);
  await expect(confirmacion).toHaveCount(0);
  expect(await vencimientosDe(cliente.id)).toHaveLength(1);

  await page.getByRole('link', { name: 'Borrar', exact: true }).click();
  await page.getByRole('button', { name: 'Sí, borrar' }).click();
  await expect(page).toHaveURL('/vencimientos?ok=borrado');
  await expect(aviso(page)).toContainText('Vencimiento borrado');
  expect(await vencimientosDe(cliente.id)).toEqual([]);

  await page.getByRole('link', { name: 'Cerrar aviso' }).click();
  await expect(page).toHaveURL('/vencimientos');
  await page.goto(detalle);
  await expect(page.getByRole('heading', { name: 'Vencimiento no encontrado' })).toBeVisible();
});

test('paginación: 20 por página y "Siguiente" conserva el filtro de cliente', async ({ page }) => {
  const cliente = await nuevoCliente('Pag venc');
  const iva = await impuestoApi(token(), 'IVA');
  // 21 períodos mensuales distintos (2024-01 … 2025-09), con fechas futuras: todos pendientes.
  await Promise.all(
    Array.from({ length: 21 }, (_, i) =>
      crearVencimientoApi(token(), {
        clienteId: cliente.id,
        impuestoId: iva.id,
        fechaVencimiento: fechaRelativa(40 + i),
        periodo: `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`,
      }),
    ),
  );

  await page.goto(`/vencimientos?cliente=${cliente.id}`);
  const paginacion = page.getByRole('navigation', { name: 'Paginación' });
  await expect(filas(page)).toHaveCount(20);
  await expect(page.getByTestId('resumen-paginas')).toHaveText('Página 1 de 2 · 21 vencimientos');
  await expect(paginacion.getByText('Anterior')).toHaveAttribute('aria-disabled', 'true');

  await paginacion.getByRole('link', { name: 'Siguiente' }).click();
  await expect(page).toHaveURL(`/vencimientos?cliente=${cliente.id}&pagina=2`);
  await expect(filas(page)).toHaveCount(1);
  await expect(filas(page).first()).toContainText(formatearFecha(fechaRelativa(60)));
  await expect(page.getByTestId('resumen-paginas')).toHaveText('Página 2 de 2 · 21 vencimientos');

  await page.goto(`/vencimientos?cliente=${cliente.id}&pagina=9`);
  await expect(page.getByText('No hay vencimientos en esta página')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ir a la página 1' })).toHaveAttribute(
    'href',
    `/vencimientos?cliente=${cliente.id}`,
  );
});

test('desde el cliente: "Nuevo vencimiento" con el cliente elegido y "Ver vencimientos" en Todos', async ({
  page,
}) => {
  const cliente = await nuevoCliente('Desde cliente');
  await page.goto(`/clientes/${cliente.id}`);
  await page.getByRole('link', { name: 'Nuevo vencimiento' }).click();
  await expect(page).toHaveURL(`/vencimientos/nuevo?cliente=${cliente.id}`);
  await expect(campo(page, 'Cliente')).toHaveValue(cliente.id);
  // Cancelar vuelve al cliente.
  await page.getByRole('link', { name: 'Cancelar' }).click();
  await expect(page).toHaveURL(`/clientes/${cliente.id}`);

  await page.getByRole('link', { name: 'Ver vencimientos' }).click();
  await expect(page).toHaveURL(`/vencimientos?estado=todos&cliente=${cliente.id}`);
  await expect(
    page.getByRole('navigation', { name: 'Estado' }).locator('[aria-current="page"]'),
  ).toHaveText('Todos');
  await expect(page.getByText('No hay vencimientos con estos filtros')).toBeVisible();

  const deBaja = await nuevoCliente('Desde cliente baja');
  await api(token(), `/clientes/${deBaja.id}`, { method: 'DELETE' });
  await page.goto(`/clientes/${deBaja.id}`);
  await expect(page.getByRole('link', { name: 'Ver vencimientos' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nuevo vencimiento' })).toHaveCount(0);
});
