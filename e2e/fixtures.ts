import { readFileSync } from 'node:fs';

import { test as base, expect, type Page, type Response } from '@playwright/test';

import { digitoVerificador } from '../src/lib/cuit';

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

/** Token de una sesión guardada por global-setup (para llamar a la API desde Node). */
export function tokenDeSesion(ruta: string): string {
  const estado = JSON.parse(readFileSync(ruta, 'utf8')) as {
    cookies: { name: string; value: string }[];
  };
  const cookie = estado.cookies.find((c) => c.name === COOKIE_NAME);
  if (!cookie) throw new Error(`No está la cookie ${COOKIE_NAME} en ${ruta}`);
  return cookie.value;
}

/** Sufijo único para los datos que crea cada test (no depender del orden ni de corridas previas). */
export function sufijoUnico(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** CUIT aleatorio con dígito verificador válido (misma regla que la API). */
export function cuitAleatorio(): string {
  for (;;) {
    const primeros = `30${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
    const dv = digitoVerificador(primeros);
    if (dv !== null) return `${primeros}${dv}`;
  }
}

export interface ClienteApi {
  id: string;
  razonSocial: string;
  cuit: string;
  email: string;
  telefono: string | null;
  condicionIVA: string;
  activo: boolean;
  usuarioId: string | null;
}

/** Llama a la API desde Node (nunca desde el navegador) con el token dado. */
export async function api<T>(
  token: string,
  ruta: string,
  opciones: { method?: string; body?: unknown } = {},
): Promise<T> {
  const r = await fetch(new URL(ruta, env.E2E_API_URL), {
    method: opciones.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opciones.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: opciones.body === undefined ? undefined : JSON.stringify(opciones.body),
  });
  if (!r.ok) throw new Error(`${opciones.method ?? 'GET'} ${ruta} → ${r.status}: ${await r.text()}`);
  return (r.status === 204 ? undefined : await r.json()) as T;
}

/** Crea un cliente por la API, para preparar datos. Completa con valores válidos lo que falte. */
export function crearClienteApi(
  token: string,
  datos: Partial<Pick<ClienteApi, 'razonSocial' | 'cuit' | 'email' | 'telefono' | 'condicionIVA'>> = {},
): Promise<ClienteApi> {
  return api<ClienteApi>(token, '/clientes', {
    method: 'POST',
    body: {
      razonSocial: `E2E Cliente ${sufijoUnico()}`,
      cuit: cuitAleatorio(),
      email: 'contacto@example.com',
      condicionIVA: 'monotributista',
      ...datos,
    },
  });
}

export interface ImpuestoApi {
  id: string;
  codigo: string;
  nombre: string;
  periodicidad: 'mensual' | 'anual';
}

export interface VencimientoApi {
  id: string;
  clienteId: string;
  cliente: { id: string; razonSocial: string; cuit: string };
  impuestoId: string;
  impuesto: ImpuestoApi;
  fechaVencimiento: string;
  periodo: string;
  estado: 'pendiente' | 'presentado';
  estadoActual: 'pendiente' | 'presentado' | 'vencido';
  fechaPresentacion: string | null;
  notas: string | null;
}

export function impuestosApi(token: string): Promise<ImpuestoApi[]> {
  return api<ImpuestoApi[]>(token, '/impuestos');
}

/** Impuesto del seed por código (`IVA`, `GANANCIAS`, …). */
export async function impuestoApi(token: string, codigo: string): Promise<ImpuestoApi> {
  const impuesto = (await impuestosApi(token)).find((i) => i.codigo === codigo);
  if (!impuesto) throw new Error(`No está el impuesto ${codigo} en GET /impuestos`);
  return impuesto;
}

/** Crea un vencimiento por la API, para preparar datos. */
export function crearVencimientoApi(
  token: string,
  datos: { clienteId: string; impuestoId: string; fechaVencimiento: string; periodo: string; notas?: string },
): Promise<VencimientoApi> {
  return api<VencimientoApi>(token, '/vencimientos', { method: 'POST', body: datos });
}

/** `YYYY-MM-DD` a `dias` de hoy en Argentina (negativo = pasado), sin pasar por la zona local. */
export function fechaRelativa(dias: number): string {
  const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
  const [a, m, d] = hoy.split('-').map(Number);
  // Aritmética en UTC sobre la fecha (sin hora): no la corre ninguna zona horaria.
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}
