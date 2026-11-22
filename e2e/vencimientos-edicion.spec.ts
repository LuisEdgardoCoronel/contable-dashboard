import type { Page } from '@playwright/test';

import { formatearFecha } from '../src/lib/fechas';
import { formatearPeriodo } from '../src/lib/vencimientos';

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

// ---------------------------------------------------------------------------
// Marcar como presentado desde el listado, "Tarde" y cambio de la fecha de vencimiento

/** Un vencimiento de IVA para ese cliente, `dias` desde hoy. */
async function vencimientoIva(cliente: ClienteApi, dias: number, periodo: string): Promise<VencimientoApi> {
  const iva = await impuestoApi(token(), 'IVA');
  return crearVencimientoApi(token(), {
    clienteId: cliente.id,
    impuestoId: iva.id,
    fechaVencimiento: fechaRelativa(dias),
    periodo,
  });
}

const presentarApi = (v: VencimientoApi, fechaPresentacion: string) =>
  api<VencimientoApi>(token(), `/vencimientos/${v.id}`, {
    method: 'PATCH',
    body: { estado: 'presentado', fechaPresentacion },
  });

const leerApi = (v: VencimientoApi) => api<VencimientoApi>(token(), `/vencimientos/${v.id}`);

/** El botón de una fila: su nombre accesible identifica al vencimiento. */
const botonPresentar = (page: Page, v: VencimientoApi, cliente: ClienteApi) =>
  page.getByRole('button', {
    name: `Marcar como presentado (IVA ${formatearPeriodo(v.periodo)}, ${cliente.razonSocial})`,
    exact: true,
  });

const todosLosBotones = (page: Page) => page.getByRole('button', { name: /^Marcar como presentado \(/ });

test('marcar como presentado desde Vencidos: "Marcando…", vuelve al mismo listado y queda con la fecha de hoy', async ({
  page,
}) => {
  const cliente = await nuevoCliente('Presentar listado');
  const primero = await vencimientoIva(cliente, -10, '2026-01');
  const segundo = await vencimientoIva(cliente, -5, '2026-02');
  const listado = `/vencimientos?estado=vencido&cliente=${cliente.id}`;

  await page.goto(listado);
  await expect(filas(page)).toHaveCount(2);

  // Demora la Server Action para ver el estado pendiente del botón.
  let liberar!: () => void;
  const demora = new Promise<void>((r) => (liberar = r));
  await page.route(
    (url) => url.pathname === '/vencimientos',
    async (ruta) => {
      if (ruta.request().method() === 'POST') await demora;
      await ruta.continue();
    },
  );

  await botonPresentar(page, primero, cliente).click();
  const marcando = page.getByRole('button', { name: /^Marcando…/ });
  await expect(marcando).toBeVisible();
  await expect(marcando).toBeDisabled();
  liberar();

  await expect(page).toHaveURL(`${listado}&ok=presentado`);
  await expect(aviso(page)).toContainText('Marcado como presentado');
  await expect(filas(page)).toHaveCount(1);
  await expect(filas(page).first()).toContainText(formatearPeriodo(segundo.periodo));
  expect(await leerApi(primero)).toMatchObject({ estadoActual: 'presentado', fechaPresentacion: fechaRelativa(0) });
  expect((await leerApi(segundo)).estadoActual).toBe('vencido');

  // "Cerrar" saca el aviso y conserva el listado.
  await aviso(page).getByRole('link', { name: 'Cerrar aviso' }).click();
  await expect(page).toHaveURL(listado);

  // En Presentados y Todos no hay botón.
  for (const pestana of ['presentado', 'todos']) {
    await page.goto(`/vencimientos?estado=${pestana}&cliente=${cliente.id}`);
    await expect(filas(page).first()).toBeVisible();
    await expect(todosLosBotones(page)).toHaveCount(0);
  }
});

test.describe('sin JavaScript (mejoras)', () => {
  test.use({ javaScriptEnabled: false });

  // Solo los casos exitosos (ver "Errores de formularios sin JS" en CLAUDE.md).
  test('"Marcar como presentado" de una fila vuelve al listado con el aviso', async ({ page }) => {
    const cliente = await nuevoCliente('Presentar sin JS');
    const v = await vencimientoIva(cliente, 10, '2026-03');
    const listado = `/vencimientos?cliente=${cliente.id}`;

    await page.goto(listado);
    await botonPresentar(page, v, cliente).click();

    await expect(page).toHaveURL(`${listado}&ok=presentado`);
    await expect(aviso(page)).toContainText('Marcado como presentado');
    await expect(page.getByText('No hay vencimientos con estos filtros')).toBeVisible();
    expect(await leerApi(v)).toMatchObject({ estadoActual: 'presentado', fechaPresentacion: fechaRelativa(0) });
  });

  test('cambiar la fecha de vencimiento', async ({ page }) => {
    const cliente = await nuevoCliente('Fecha sin JS');
    const v = await vencimientoIva(cliente, -4, '2026-04');
    const nueva = fechaRelativa(12);

    await page.goto(`/vencimientos/${v.id}`);
    await page.getByRole('link', { name: 'Cambiar la fecha de vencimiento' }).click();
    await page.getByLabel('Nueva fecha de vencimiento').fill(nueva);
    await page.getByRole('button', { name: 'Guardar fecha' }).click();

    await expect(page).toHaveURL(`/vencimientos/${v.id}?ok=fecha`);
    await expect(aviso(page)).toContainText('Fecha de vencimiento cambiada');
    await expect(estado(page)).toHaveText('Pendiente');
    expect(await leerApi(v)).toMatchObject({ fechaVencimiento: nueva, estadoActual: 'pendiente' });
  });
});

test.describe('en el celular', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('"Marcar como presentado" desde la tarjeta', async ({ page }) => {
    const cliente = await nuevoCliente('Presentar celular');
    const v = await vencimientoIva(cliente, 3, '2026-05');
    const listado = `/vencimientos?cliente=${cliente.id}`;

    await page.goto(listado);
    await expect(page.getByRole('table')).toBeHidden();
    const boton = botonPresentar(page, v, cliente);
    await expect(boton).toBeInViewport();
    await boton.click();

    await expect(page).toHaveURL(`${listado}&ok=presentado`);
    await expect(aviso(page)).toContainText('Marcado como presentado');
    await expect(boton).toHaveCount(0);
    expect((await leerApi(v)).estadoActual).toBe('presentado');
  });
});

test('"Tarde": en el listado y en el detalle, solo si se presentó después del vencimiento', async ({ page }) => {
  const cliente = await nuevoCliente('Tarde');
  const tarde = await presentarApi(await vencimientoIva(cliente, -10, '2026-06'), fechaRelativa(-3));
  const aTiempo = await presentarApi(await vencimientoIva(cliente, -10, '2026-07'), fechaRelativa(-10));

  await page.goto(`/vencimientos?estado=presentado&cliente=${cliente.id}`);
  await expect(filas(page)).toHaveCount(2);
  const fila = (v: VencimientoApi) => filas(page).filter({ hasText: formatearPeriodo(v.periodo) });
  await expect(fila(tarde).getByTestId('presentado-tarde')).toHaveText('Tarde');
  await expect(fila(aTiempo).getByTestId('presentado-tarde')).toHaveCount(0);

  const tardeEnDetalle = page.getByTestId('presentado-tarde').filter({ visible: true });
  await page.goto(`/vencimientos/${tarde.id}`);
  await expect(estado(page)).toHaveText('Presentado');
  await expect(tardeEnDetalle).toHaveText('Tarde');
  await expect(page.getByTestId('presentado-tarde-detalle')).toHaveText(
    `Se presentó después de la fecha de vencimiento (${formatearFecha(tarde.fechaVencimiento)}).`,
  );

  await page.goto(`/vencimientos/${aTiempo.id}`);
  await expect(estado(page)).toHaveText('Presentado');
  await expect(tardeEnDetalle).toHaveCount(0);
  await expect(page.getByTestId('presentado-tarde-detalle')).toHaveCount(0);
});

test('cambiar la fecha de vencimiento: validación, Cancelar, estado recalculado y "Tarde"', async ({ page }) => {
  const cliente = await nuevoCliente('Cambiar fecha');
  const v = await vencimientoIva(cliente, -10, '2026-08');
  const detalle = `/vencimientos/${v.id}`;
  const campoFecha = page.getByLabel('Nueva fecha de vencimiento');
  const guardar = page.getByRole('button', { name: 'Guardar fecha' });

  await page.goto(detalle);
  await expect(estado(page)).toHaveText('Vencido');
  await page.getByRole('link', { name: 'Cambiar la fecha de vencimiento' }).click();
  await expect(page).toHaveURL(`${detalle}?editar=fecha`);
  await expect(campoFecha).toHaveValue(v.fechaVencimiento);

  // Cancelar vuelve al detalle sin tocar nada.
  await page.getByRole('link', { name: 'Cancelar' }).click();
  await expect(page).toHaveURL(detalle);
  await expect(campoFecha).toHaveCount(0);

  // Vacía: error en el campo, sin llamar a la API.
  await page.goto(`${detalle}?editar=fecha`);
  await campoFecha.fill('');
  await guardar.click();
  await expect(page.locator('#fechaVencimiento-error')).toHaveText('Ingresá una fecha válida');
  await expect(campoFecha).toHaveAttribute('aria-invalid', 'true');
  expect((await leerApi(v)).fechaVencimiento).toBe(v.fechaVencimiento);

  // A futuro: el vencido pasa a pendiente (lo recalcula la API).
  const futura = fechaRelativa(15);
  await campoFecha.fill(futura);
  await guardar.click();
  await expect(page).toHaveURL(`${detalle}?ok=fecha`);
  await expect(aviso(page)).toContainText('Fecha de vencimiento cambiada');
  await expect(estado(page)).toHaveText('Pendiente');
  await expect(datos(page)).toContainText(`Fecha de vencimiento${formatearFecha(futura)}`);
  expect(await leerApi(v)).toMatchObject({ fechaVencimiento: futura, estadoActual: 'pendiente' });

  // Presentado hoy, a tiempo. Si la fecha de vencimiento pasa a antes, queda "Tarde"
  // (la API no toca la fecha de presentación).
  await presentarApi(v, fechaRelativa(0));
  await page.goto(`${detalle}?editar=fecha`);
  const pasada = fechaRelativa(-2);
  await campoFecha.fill(pasada);
  await guardar.click();
  await expect(page).toHaveURL(`${detalle}?ok=fecha`);
  await expect(estado(page)).toHaveText('Presentado');
  await expect(page.getByTestId('presentado-tarde').filter({ visible: true })).toHaveText('Tarde');
  expect(await leerApi(v)).toMatchObject({ fechaVencimiento: pasada, fechaPresentacion: fechaRelativa(0) });
});
