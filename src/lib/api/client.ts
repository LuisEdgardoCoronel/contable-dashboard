import 'server-only';

import { redirect } from 'next/navigation';

import { getToken } from '@/lib/auth/session';
import { env } from '@/lib/env';

export const MENSAJE_SIN_CONEXION = 'No se pudo conectar con el servidor';
const TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type ValorQuery = string | number | boolean | null | undefined;

export interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, ValorQuery>;
  /**
   * Token explícito. Si se omite, se usa el de la cookie de sesión.
   * `null` = sin token (login). Con token explícito, un 401 se lanza como
   * `ApiError` en vez de redirigir al login.
   */
  token?: string | null;
}

export async function apiFetch<T>(path: string, opciones: ApiFetchOptions = {}): Promise<T> {
  const { method = 'GET', body, query } = opciones;
  const tokenDeCookie = opciones.token === undefined;
  const token = tokenDeCookie ? await getToken() : opciones.token;

  const url = new URL(`${env.API_URL}${path}`);
  for (const [clave, valor] of Object.entries(query ?? {})) {
    if (valor !== undefined && valor !== null && valor !== '') {
      url.searchParams.set(clave, String(valor));
    }
  }

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // API caída, DNS, conexión rechazada o timeout.
    throw new ApiError(502, MENSAJE_SIN_CONEXION);
  }

  if (respuesta.status === 401 && tokenDeCookie) {
    // Token vencido o revocado: los Server Components no pueden borrar la
    // cookie, así que lo hace /api/auth/salir. redirect() lanza, va fuera de try.
    redirect('/api/auth/salir');
  }

  if (!respuesta.ok) {
    throw new ApiError(respuesta.status, await leerMensajeDeError(respuesta));
  }

  if (respuesta.status === 204) return undefined as T;

  const texto = await respuesta.text();
  if (!texto) return undefined as T;
  try {
    return JSON.parse(texto) as T;
  } catch {
    throw new ApiError(502, 'Respuesta inválida del servidor');
  }
}

/** Normaliza el cuerpo de error de Nest: `message` puede ser string o string[]. */
async function leerMensajeDeError(respuesta: Response): Promise<string> {
  try {
    const cuerpo: unknown = await respuesta.json();
    if (cuerpo && typeof cuerpo === 'object' && 'message' in cuerpo) {
      const { message } = cuerpo as { message: unknown };
      if (Array.isArray(message)) return message.map(String).join('. ');
      if (typeof message === 'string' && message) return message;
    }
  } catch {
    // cuerpo vacío o no JSON
  }
  return respuesta.statusText || `Error ${respuesta.status}`;
}
