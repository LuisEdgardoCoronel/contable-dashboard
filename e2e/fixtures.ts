import { test as base, expect, type Page, type Response } from '@playwright/test';

import { leerEnv, MENSAJE_429 } from './env';

export const env = leerEnv();
const origenApi = new URL(env.E2E_API_URL).origin;

export const COOKIE_NAME = 'contable_token';

type Fixtures = {
  /** URLs que el navegador pidió a la API. Se verifica vacío al final de cada test. */
  requestsALaApi: string[];
  /** Todas las URLs que pidió el navegador (para que el chequeo no sea vacuo). */
  requestsDelNavegador: string[];
};

export const test = base.extend<Fixtures>({
  requestsDelNavegador: async ({}, usar) => {
    await usar([]);
  },
  requestsALaApi: [
    async ({ page, requestsDelNavegador }, usar) => {
      const aLaApi: string[] = [];
      page.on('request', (req) => {
        const url = new URL(req.url());
        requestsDelNavegador.push(req.url());
        if (url.origin === origenApi || url.port === '3000') aLaApi.push(req.url());
      });
      await usar(aLaApi);
      expect(aLaApi, 'el navegador nunca debe llamar a la API').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Completa y envía el login. Si la API devuelve 429, corta con un mensaje claro. */
export async function loguear(page: Page, email: string, password: string): Promise<Response> {
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  const [respuesta] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST'),
    page.getByRole('button', { name: 'Ingresar' }).click(),
  ]);
  if (respuesta.status() === 429) throw new Error(MENSAJE_429);
  return respuesta;
}

/** JWT con firma falsa y el `exp` indicado (segundos desde ahora). */
export function jwtFalso(expEnSegundos: number): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + expEnSegundos;
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'no-existe', rol: 'admin', exp })}.firma-invalida`;
}
