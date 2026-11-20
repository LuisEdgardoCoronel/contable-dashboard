import { request, type FullConfig } from '@playwright/test';

import { asegurarCarpetaAuth, leerEnv, MENSAJE_429, RUTA_SESION_ADMIN } from './env';

// Corre una vez, después de levantar el webServer:
// 1. valida .env.test y que la API responda;
// 2. loguea al admin de demo por el route handler del dashboard (1 de los 6
//    intentos por minuto) y guarda la sesión para los tests que no prueban el login.
export default async function globalSetup(config: FullConfig) {
  const env = leerEnv();
  const baseURL = config.projects[0].use.baseURL!;

  try {
    const r = await fetch(`${env.E2E_API_URL}/docs-json`, { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error(`status ${r.status}`);
  } catch (e) {
    throw new Error(
      `La API no responde en ${env.E2E_API_URL} (${String(e)}). ` +
        'Levantala y corré `npm run seed:demo` en contable-api.',
    );
  }

  const ctx = await request.newContext({ baseURL });
  try {
    const r = await ctx.post('/api/auth/login', {
      data: { email: env.E2E_ADMIN_EMAIL, password: env.E2E_ADMIN_PASSWORD },
    });
    if (r.status() === 429) throw new Error(MENSAJE_429);
    if (r.status() !== 204) {
      throw new Error(
        `No se pudo loguear al admin de demo (${r.status()}: ${await r.text()}). ` +
          '¿Corriste `npm run seed:demo` en contable-api?',
      );
    }
    asegurarCarpetaAuth();
    await ctx.storageState({ path: RUTA_SESION_ADMIN });
  } finally {
    await ctx.dispose();
  }
}
