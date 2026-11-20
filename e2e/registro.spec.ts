import { MENSAJE_429, RUTA_SESION_ADMIN } from './env';
import { COOKIE_NAME, env, expect, test } from './fixtures';

// Rate limit: solo "registro exitoso" gasta un intento de login (el login
// automático). Los demás no llegan a loguear.

async function completar(
  page: import('@playwright/test').Page,
  datos: { nombre: string; email: string; password: string },
) {
  await page.getByLabel('Nombre').fill(datos.nombre);
  await page.getByLabel('Email').fill(datos.email);
  await page.getByLabel('Contraseña').fill(datos.password);
  const [respuesta] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith('/api/auth/registro') && r.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Crear cuenta' }).click(),
  ]);
  return respuesta;
}

test('el login enlaza al registro y el registro vuelve al login', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Creá una' }).click();
  await expect(page).toHaveURL(/\/registro$/);
  await expect(page.getByText('Creá tu cuenta')).toBeVisible();

  await page.getByRole('link', { name: 'Ingresá' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('registro exitoso: entra al panel con un estudio vacío', async ({ page }) => {
  // Cada corrida crea un admin nuevo en la base de demo (email único).
  const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const nombre = `Estudio E2E ${sufijo}`;
  await page.goto('/registro');
  const respuesta = await completar(page, {
    nombre,
    email: `e2e-${sufijo}@example.com`,
    password: 'unaClaveSegura',
  });
  expect(respuesta.status()).toBe(201);
  const cuerpo = (await respuesta.json()) as { sesion: boolean; message?: string };
  if (!cuerpo.sesion && /pudimos iniciar sesión/.test(cuerpo.message ?? '')) {
    // El login automático falló: casi seguro por el rate limit.
    throw new Error(MENSAJE_429);
  }
  expect(cuerpo.sesion).toBe(true);

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: `Hola, ${nombre}` })).toBeVisible();

  const cookie = (await page.context().cookies()).find((c) => c.name === COOKIE_NAME);
  expect(cookie?.httpOnly).toBe(true);

  // Estudio nuevo: todo en cero, "Vencidos" en estilo neutro y gráficos vacíos.
  const vencidos = page.getByTestId('tarjeta-vencidos');
  await expect(vencidos.getByTestId('valor')).toHaveText('0');
  await expect(vencidos).not.toHaveAttribute('data-destacada');
  await expect(page.getByText('No hay vencimientos en este rango')).toHaveCount(2);
});

test('un email ya registrado muestra "Ese email ya está registrado"', async ({ page }) => {
  await page.goto('/registro');
  const respuesta = await completar(page, {
    nombre: 'Otro estudio',
    email: env.E2E_ADMIN_EMAIL,
    password: 'unaClaveSegura',
  });
  expect(respuesta.status()).toBe(409);
  // Hay otro role=alert: el anunciador de rutas de Next. Se filtra por texto.
  await expect(page.getByRole('alert').filter({ hasText: 'Ese email' })).toHaveText(
    'Ese email ya está registrado',
  );
  await expect(page).toHaveURL(/\/registro$/);
  expect((await page.context().cookies()).find((c) => c.name === COOKIE_NAME)).toBeUndefined();
});

test('el route handler valida antes de llamar a la API', async ({ request }) => {
  const corta = await request.post('/api/auth/registro', {
    data: { nombre: 'X', email: 'x@example.com', password: 'corta' },
  });
  expect(corta.status()).toBe(400);
  expect((await corta.json()).message).toBe('La contraseña tiene que tener entre 8 y 72 caracteres');

  const vacio = await request.post('/api/auth/registro', { data: {} });
  expect(vacio.status()).toBe(400);
  expect((await vacio.json()).message).toBe('Revisá los datos');
});

test.describe('con sesión de admin', () => {
  test.use({ storageState: RUTA_SESION_ADMIN });

  test('/registro redirige a /', async ({ page }) => {
    await page.goto('/registro');
    await expect(page).toHaveURL(/\/$/);
  });
});
