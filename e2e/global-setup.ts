import { request, type FullConfig } from '@playwright/test';

import {
  asegurarCarpetaAuth,
  leerEnv,
  MENSAJE_429,
  RUTA_SESION_ADMIN,
  RUTA_SESION_PROPIA,
} from './env';

// Corre una vez, después de levantar el webServer:
// 1. valida .env.test y que la API responda;
// 2. loguea al admin de demo por el route handler del dashboard (1 de los 7
//    intentos por minuto) y guarda la sesión para los tests que solo leen;
// 3. registra un admin propio (estudio nuevo y vacío; el login automático del
//    registro es otro de los 7 intentos) y guarda su sesión para los tests que
//    crean o modifican clientes, así no se ensucian los datos de demo.
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

  asegurarCarpetaAuth();
  await loguearAdminDemo(baseURL, env);
  await registrarAdminPropio(baseURL);
}

async function loguearAdminDemo(baseURL: string, env: ReturnType<typeof leerEnv>) {
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
    await ctx.storageState({ path: RUTA_SESION_ADMIN });
  } finally {
    await ctx.dispose();
  }
}

async function registrarAdminPropio(baseURL: string) {
  // Queda en la base (ver "Pendiente para el deploy" en CLAUDE.md: falta un script de limpieza).
  const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const ctx = await request.newContext({ baseURL });
  try {
    const r = await ctx.post('/api/auth/registro', {
      data: {
        nombre: `Estudio E2E Clientes ${sufijo}`,
        email: `e2e-clientes-${sufijo}@example.com`,
        password: 'unaClaveSegura',
      },
    });
    if (r.status() !== 201) {
      throw new Error(`No se pudo registrar el admin propio (${r.status()}: ${await r.text()}).`);
    }
    const cuerpo = (await r.json()) as { sesion: boolean };
    // Cuenta creada pero sin login automático: casi seguro el rate limit.
    if (!cuerpo.sesion) throw new Error(MENSAJE_429);
    await ctx.storageState({ path: RUTA_SESION_PROPIA });
  } finally {
    await ctx.dispose();
  }
}
