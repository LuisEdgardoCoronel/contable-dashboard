import { RUTA_SESION_ADMIN } from './env';
import { COOKIE_NAME, env, expect, jwtFalso, loguear, test } from './fixtures';

// Rate limit: los tests de "login por la UI" usan 4 intentos, global-setup 2 (admin de demo
// y admin propio) y el registro exitoso 1 (7 por corrida; con LOGIN_RATE_LIMIT en el default
// de 5, la API da 429).
// No agregar logins: reusar RUTA_SESION_ADMIN o RUTA_SESION_PROPIA.

async function cookieDeSesion(page: import('@playwright/test').Page) {
  const cookies = await page.context().cookies();
  return cookies.find((c) => c.name === COOKIE_NAME);
}

test.describe('sin sesión', () => {
  test('1. / redirige a /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
  });

  test('una ruta protegida conserva el destino en ?next', async ({ page }) => {
    await page.goto('/clientes?page=2');
    const url = new URL(page.url());
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('next')).toBe('/clientes?page=2');
  });
});

test.describe('login por la UI', () => {
  test('2. credenciales malas → "Email o contraseña incorrectos"', async ({ page }) => {
    await page.goto('/login');
    const r = await loguear(page, env.E2E_ADMIN_EMAIL, 'contraseña-incorrecta');
    expect(r.status()).toBe(401);
    await expect(page.locator('form').getByRole('alert')).toHaveText('Email o contraseña incorrectos');
    await expect(page).toHaveURL(/\/login$/);
    expect(await cookieDeSesion(page)).toBeUndefined();
  });

  test('3. el admin de demo entra y ve su nombre', async ({ page }) => {
    await page.goto('/login');
    await loguear(page, env.E2E_ADMIN_EMAIL, env.E2E_ADMIN_PASSWORD);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('banner').getByText(`Hola, ${env.E2E_ADMIN_NOMBRE}`)).toBeVisible();

    const cookie = await cookieDeSesion(page);
    expect(cookie).toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.sameSite).toBe('Lax');
    expect(cookie!.path).toBe('/');
    // El token no es accesible desde JS de la página.
    expect(await page.evaluate(() => document.cookie)).not.toContain(COOKIE_NAME);
  });

  test('4. el usuario cliente es rechazado: "solo para contadores"', async ({ page }) => {
    await page.goto('/login');
    const r = await loguear(page, env.E2E_CLIENTE_EMAIL, env.E2E_CLIENTE_PASSWORD);
    expect(r.status()).toBe(403);
    await expect(page.locator('form').getByRole('alert')).toHaveText('Este panel es solo para contadores');
    await expect(page).toHaveURL(/\/login$/);
    expect(await cookieDeSesion(page)).toBeUndefined();
  });

  test('5. con ?next=//evil.com, después del login queda en /', async ({ page }) => {
    await page.goto('/login?next=//evil.com');
    await loguear(page, env.E2E_ADMIN_EMAIL, env.E2E_ADMIN_PASSWORD);
    await expect(page.getByRole('banner').getByText(/^Hola, /)).toBeVisible();
    const url = new URL(page.url());
    expect(url.origin).toBe('http://localhost:3001');
    expect(url.pathname).toBe('/');
  });
});

test.describe('cookies inválidas', () => {
  test('6. un token inválido termina en /login, sin loop, y la cookie queda borrada', async ({
    page,
    context,
  }) => {
    // exp futuro para que el proxy lo deje pasar y sea la API la que lo rechace (401).
    await context.addCookies([
      { name: COOKIE_NAME, value: jwtFalso(3600), url: 'http://localhost:3001' },
    ]);
    const respuesta = await page.goto('/'); // un loop daría ERR_TOO_MANY_REDIRECTS
    expect(respuesta?.status()).toBe(200);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
    expect(await cookieDeSesion(page)).toBeUndefined();
  });

  test('un token vencido se trata como ausente: /login se muestra sin loop', async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: COOKIE_NAME, value: jwtFalso(-60), url: 'http://localhost:3001' },
    ]);
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    const respuesta = await page.goto('/login');
    expect(respuesta?.status()).toBe(200);
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
  });
});

test.describe('con sesión de admin', () => {
  test.use({ storageState: RUTA_SESION_ADMIN });

  test('con sesión, /login redirige a /', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/$/);
  });

  test('7. "Cerrar sesión" borra la cookie y vuelve a /login', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('banner').getByText(/^Hola, /)).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);
    expect(await cookieDeSesion(page)).toBeUndefined();

    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('8. ninguna request del navegador va a la API (:3000)', async ({
    page,
    requestsALaApi,
    requestsDelNavegador,
  }) => {
    // El fixture automático hace este chequeo en TODOS los tests (incluidos los
    // de login por la UI). Acá recorremos panel → logout → login de forma explícita.
    await page.goto('/');
    await expect(page.getByRole('banner').getByText(/^Hola, /)).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page).toHaveURL(/\/login$/);

    expect(requestsDelNavegador.length).toBeGreaterThan(0);
    expect(requestsDelNavegador.every((u) => u.startsWith('http://localhost:3001/'))).toBe(true);
    expect(requestsALaApi).toEqual([]);
  });
});
