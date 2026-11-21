import type { Page } from '@playwright/test';

import { formatearCuit } from '../src/lib/cuit';

import { RUTA_SESION_PROPIA } from './env';
import {
  api,
  crearClienteApi,
  cuitAleatorio,
  env,
  expect,
  sufijoUnico,
  test,
  tokenDeSesion,
  type ClienteApi,
} from './fixtures';

// Crean y modifican clientes: usan el admin propio que registra global-setup, no
// el de demo. Cada test crea sus propios clientes ("E2E … <sufijo>"), así no
// dependen del orden ni de lo que dejó una corrida anterior.
test.use({ storageState: RUTA_SESION_PROPIA });

const token = () => tokenDeSesion(RUTA_SESION_PROPIA);

const URL_DETALLE = /\/clientes\/[0-9a-f-]{36}\?ok=/;

async function buscarEnApi(search: string, activo?: boolean): Promise<ClienteApi[]> {
  const qs = new URLSearchParams({ search, limit: '100' });
  if (activo !== undefined) qs.set('activo', String(activo));
  return (await api<{ data: ClienteApi[] }>(token(), `/clientes?${qs}`)).data;
}

async function completarCliente(
  page: Page,
  datos: { razonSocial: string; cuit: string; email: string; telefono?: string; condicionIVA?: string },
) {
  await page.getByLabel('Razón social', { exact: true }).fill(datos.razonSocial);
  await page.getByLabel('CUIT', { exact: true }).fill(datos.cuit);
  await page.getByLabel('Email de contacto').fill(datos.email);
  if (datos.telefono !== undefined) await page.getByLabel('Teléfono (opcional)').fill(datos.telefono);
  await page.getByLabel('Condición frente al IVA').selectOption(datos.condicionIVA ?? 'monotributista');
}

// Next 16 conserva las rutas visitadas ocultas en el DOM (display: none) para volver
// atrás sin perder su estado: los helpers filtran por visibles.
const aviso = (page: Page) => page.getByRole('status').filter({ visible: true });
const datos = (page: Page) => page.getByTestId('datos-cliente').filter({ visible: true });
const estado = (page: Page) => page.getByTestId('estado-cliente').filter({ visible: true });
const filas = (page: Page) => page.getByRole('table').locator('tbody tr');

test('alta: lleva al detalle con "Cliente creado" y aparece en el listado', async ({ page }) => {
  const razonSocial = `E2E Alta ${sufijoUnico()}`;
  const cuit = cuitAleatorio();
  await page.goto('/clientes');
  // .first(): en un estudio vacío también está el link del mensaje de vacío.
  await page.getByRole('link', { name: 'Nuevo cliente' }).first().click();
  await expect(page).toHaveURL(/\/clientes\/nuevo$/);

  await completarCliente(page, { razonSocial, cuit, email: 'alta@example.com', condicionIVA: 'exento' });
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page).toHaveURL(URL_DETALLE);
  await expect(page).toHaveURL(/\?ok=creado$/);
  await expect(aviso(page)).toContainText('Cliente creado');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(razonSocial);
  await expect(datos(page)).toContainText(formatearCuit(cuit));
  await expect(datos(page)).toContainText('Exento');

  // "Cerrar" saca el aviso de la URL.
  await page.getByRole('link', { name: 'Cerrar aviso' }).click();
  await expect(page).toHaveURL(/\/clientes\/[0-9a-f-]{36}$/);
  await expect(page.getByText('Cliente creado')).toHaveCount(0);

  await page.goto(`/clientes?buscar=${encodeURIComponent(razonSocial)}`);
  await expect(filas(page)).toHaveCount(1);
  await expect(filas(page).first()).toContainText(razonSocial);
});

test('validación en el front: CUIT inválido y razón social vacía, sin perder lo cargado', async ({
  page,
}) => {
  const razonSocial = `E2E Validacion ${sufijoUnico()}`;
  await page.goto('/clientes/nuevo');
  await completarCliente(page, { razonSocial, cuit: '30-71234567-0', email: 'valida@example.com' });
  await page.getByRole('button', { name: 'Guardar' }).click();

  const cuit = page.getByLabel('CUIT', { exact: true });
  await expect(page.locator('#cuit-error')).toHaveText('El CUIT no es válido');
  await expect(cuit).toHaveAttribute('aria-invalid', 'true');
  await expect(cuit).toHaveAttribute('aria-describedby', 'cuit-ayuda cuit-error');
  await expect(page).toHaveURL(/\/clientes\/nuevo$/);
  // Los valores se conservan.
  await expect(cuit).toHaveValue('30-71234567-0');
  await expect(page.getByLabel('Razón social', { exact: true })).toHaveValue(razonSocial);
  await expect(page.getByLabel('Email de contacto')).toHaveValue('valida@example.com');
  await expect(page.getByLabel('Condición frente al IVA')).toHaveValue('monotributista');
  // No llegó a la API: el cliente no existe.
  expect(await buscarEnApi(razonSocial)).toEqual([]);

  await page.getByLabel('Razón social', { exact: true }).fill('');
  await cuit.fill(cuitAleatorio());
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.locator('#razonSocial-error')).toHaveText('Ingresá la razón social');
  await expect(page.locator('#cuit-error')).toHaveCount(0);
  await expect(page.getByLabel('Email de contacto')).toHaveValue('valida@example.com');
});

test('un CUIT repetido muestra el mensaje de la API en el campo CUIT', async ({ page }) => {
  const existente = await crearClienteApi(token(), { razonSocial: `E2E Original ${sufijoUnico()}` });
  await page.goto('/clientes/nuevo');
  await completarCliente(page, {
    razonSocial: `E2E Duplicado ${sufijoUnico()}`,
    cuit: formatearCuit(existente.cuit),
    email: 'dup@example.com',
  });
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page.locator('#cuit-error')).toHaveText('Ya existe un cliente con ese CUIT');
  await expect(page.getByLabel('CUIT', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL(/\/clientes\/nuevo$/);
});

test.describe('sin JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('el alta funciona y llega al detalle', async ({ page }) => {
    const razonSocial = `E2E SinJS ${sufijoUnico()}`;
    await page.goto('/clientes/nuevo');
    await completarCliente(page, { razonSocial, cuit: cuitAleatorio(), email: 'sinjs@example.com' });
    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(page).toHaveURL(/\?ok=creado$/);
    await expect(aviso(page)).toContainText('Cliente creado');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(razonSocial);
  });

  test('un error de validación se muestra y conserva los valores', async ({ page }) => {
    await page.goto('/clientes/nuevo');
    await completarCliente(page, { razonSocial: 'E2E SinJS error', cuit: '123', email: 'x@example.com' });
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.locator('#cuit-error')).toHaveText('El CUIT no es válido');
    await expect(page.getByLabel('Razón social', { exact: true })).toHaveValue('E2E SinJS error');
  });
});

test('edición: cambia teléfono y condición IVA y muestra "Cambios guardados"', async ({ page }) => {
  const cliente = await crearClienteApi(token(), { razonSocial: `E2E Edicion ${sufijoUnico()}` });
  await page.goto(`/clientes/${cliente.id}`);
  await expect(datos(page)).toContainText('Teléfono—'); // sin teléfono
  await page.getByRole('link', { name: 'Editar' }).click();
  await expect(page).toHaveURL(`/clientes/${cliente.id}/editar`);

  // El formulario trae los datos actuales.
  await expect(page.getByLabel('Razón social', { exact: true })).toHaveValue(cliente.razonSocial);
  await expect(page.getByLabel('Condición frente al IVA')).toHaveValue('monotributista');

  await page.getByLabel('Teléfono (opcional)').fill('11 4567-8900');
  await page.getByLabel('Condición frente al IVA').selectOption('responsable_inscripto');
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page).toHaveURL(`/clientes/${cliente.id}?ok=editado`);
  await expect(aviso(page)).toContainText('Cambios guardados');
  await expect(datos(page)).toContainText('Teléfono11 4567-8900');
  await expect(datos(page)).toContainText('Responsable inscripto');

  const enApi = await api<ClienteApi>(token(), `/clientes/${cliente.id}`);
  expect(enApi).toMatchObject({ telefono: '11 4567-8900', condicionIVA: 'responsable_inscripto', activo: true });
});

test('baja con confirmación, y después reactivación', async ({ page }) => {
  const razonSocial = `E2E Baja ${sufijoUnico()}`;
  const cliente = await crearClienteApi(token(), { razonSocial });
  const detalle = `/clientes/${cliente.id}`;
  const confirmacion = page.getByTestId('confirmar-baja');

  await page.goto(detalle);
  await page.getByRole('link', { name: 'Dar de baja' }).click();
  await expect(page).toHaveURL(`${detalle}?confirmar=baja`);
  await expect(confirmacion).toContainText(
    `¿Dar de baja a ${razonSocial}? Va a dejar de poder ingresar con su acceso.`,
  );

  // Cancelar no cambia nada.
  await confirmacion.getByRole('link', { name: 'Cancelar' }).click();
  await expect(page).toHaveURL(detalle);
  await expect(confirmacion).toHaveCount(0);
  await expect(estado(page)).toHaveText('Activo');

  await page.getByRole('link', { name: 'Dar de baja' }).click();
  await page.getByRole('button', { name: 'Sí, dar de baja' }).click();
  await expect(page).toHaveURL(`${detalle}?ok=baja`);
  await expect(aviso(page)).toContainText('Cliente dado de baja');
  await expect(estado(page)).toHaveText('Dado de baja');
  await expect(page.getByRole('link', { name: 'Dar de baja' })).toHaveCount(0);

  // Desaparece de "Activos" y aparece en "Dados de baja".
  await page.goto(`/clientes?buscar=${encodeURIComponent(razonSocial)}`);
  await expect(page.getByText('No hay clientes con estos filtros')).toBeVisible();
  await page.goto(`/clientes?buscar=${encodeURIComponent(razonSocial)}&estado=baja`);
  await expect(filas(page)).toHaveCount(1);
  await filas(page).getByRole('link', { name: razonSocial }).click();

  await page.getByRole('button', { name: 'Reactivar' }).click();
  await expect(page).toHaveURL(`${detalle}?ok=reactivado`);
  await expect(aviso(page)).toContainText('Cliente reactivado');
  await expect(estado(page)).toHaveText('Activo');
  // Reactivar no pisa los datos.
  expect(await api<ClienteApi>(token(), detalle)).toMatchObject({
    razonSocial,
    cuit: cliente.cuit,
    email: cliente.email,
    condicionIVA: cliente.condicionIVA,
    activo: true,
  });
});

test('crear acceso; con un email ya registrado muestra el error de la API', async ({ page }) => {
  const sufijo = sufijoUnico();
  const cliente = await crearClienteApi(token(), { razonSocial: `E2E Acceso ${sufijo}` });
  const formulario = page.getByRole('form', { name: 'Crear acceso' });

  await page.goto(`/clientes/${cliente.id}`);
  await formulario.getByLabel('Email de login').fill(`e2e-acceso-${sufijo}@example.com`);
  await formulario.getByLabel('Contraseña inicial').fill('claveInicial123');
  await formulario.getByRole('button', { name: 'Crear acceso' }).click();

  await expect(page).toHaveURL(`/clientes/${cliente.id}?ok=acceso`);
  await expect(aviso(page)).toContainText('Acceso creado');
  await expect(page.getByText('Tiene acceso al portal de clientes')).toBeVisible();
  await expect(formulario).toHaveCount(0);

  const otro = await crearClienteApi(token(), { razonSocial: `E2E Acceso otro ${sufijo}` });
  await page.goto(`/clientes/${otro.id}`);
  await formulario.getByLabel('Email de login').fill(env.E2E_ADMIN_EMAIL);
  await formulario.getByLabel('Contraseña inicial').fill('claveInicial123');
  await formulario.getByRole('button', { name: 'Crear acceso' }).click();

  await expect(page.locator('#acceso-email-error')).toHaveText('El email ya está registrado');
  await expect(formulario.getByLabel('Email de login')).toHaveValue(env.E2E_ADMIN_EMAIL);
  // La contraseña no vuelve del servidor.
  await expect(formulario.getByLabel('Contraseña inicial')).toHaveValue('');
});

test('paginación: 20 por página, conserva la búsqueda, y una página fuera de rango', async ({
  page,
}) => {
  const prefijo = `E2E Pag ${sufijoUnico()}`;
  await Promise.all(
    Array.from({ length: 21 }, (_, i) =>
      crearClienteApi(token(), { razonSocial: `${prefijo} ${String(i + 1).padStart(2, '0')}` }),
    ),
  );

  await page.goto('/clientes');
  await page.getByLabel('Razón social o CUIT').fill(prefijo);
  await page.getByRole('button', { name: 'Buscar' }).click();
  await expect(page).toHaveURL(`/clientes?buscar=${prefijo.replaceAll(' ', '+')}`);

  const paginacion = page.getByRole('navigation', { name: 'Paginación' });
  await expect(filas(page)).toHaveCount(20);
  await expect(page.getByTestId('resumen-paginas')).toHaveText('Página 1 de 2 · 21 clientes');
  await expect(paginacion.getByRole('link', { name: 'Anterior' })).toHaveCount(0);
  await expect(paginacion.getByText('Anterior')).toHaveAttribute('aria-disabled', 'true');

  await paginacion.getByRole('link', { name: 'Siguiente' }).click();
  await expect(page).toHaveURL(`/clientes?buscar=${prefijo.replaceAll(' ', '+')}&pagina=2`);
  await expect(filas(page)).toHaveCount(1);
  await expect(filas(page).first()).toContainText(`${prefijo} 21`);
  await expect(page.getByTestId('resumen-paginas')).toHaveText('Página 2 de 2 · 21 clientes');
  await expect(paginacion.getByText('Siguiente')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByLabel('Razón social o CUIT')).toHaveValue(prefijo);

  await paginacion.getByRole('link', { name: 'Anterior' }).click();
  await expect(page).toHaveURL(`/clientes?buscar=${prefijo.replaceAll(' ', '+')}`);
  await expect(filas(page)).toHaveCount(20);

  await page.goto(`/clientes?buscar=${encodeURIComponent(prefijo)}&pagina=9`);
  await expect(page.getByText('No hay clientes en esta página')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ir a la página 1' })).toHaveAttribute(
    'href',
    `/clientes?buscar=${prefijo.replaceAll(' ', '+')}`,
  );
});
