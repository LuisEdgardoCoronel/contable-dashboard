import 'server-only';

import { ApiError, apiFetch, MENSAJE_SIN_CONEXION } from '@/lib/api/client';
import type { LoginRespuesta, Perfil } from '@/lib/api/types';

import { setSessionCookie } from './session';

const MENSAJES_LOGIN: Record<number, string> = {
  400: 'Revisá los datos',
  401: 'Email o contraseña incorrectos',
  429: 'Demasiados intentos. Esperá un minuto y volvé a probar',
};

export type ResultadoSesion = { ok: true } | { ok: false; status: number; message: string };

/**
 * Loguea contra la API, exige rol admin y setea la cookie de sesión.
 * Solo se puede llamar desde un Route Handler o una Server Action (setea cookies).
 * La usan el login y el registro (login automático).
 */
export async function iniciarSesion(email: string, password: string): Promise<ResultadoSesion> {
  try {
    // Token explícito (null / el recién emitido): los errores se manejan acá,
    // apiFetch no redirige.
    const { accessToken } = await apiFetch<LoginRespuesta>('/auth/login', {
      method: 'POST',
      body: { email: email.trim(), password },
      token: null,
    });
    const perfil = await apiFetch<Perfil>('/auth/me', { token: accessToken });
    if (perfil.rol !== 'admin') {
      return { ok: false, status: 403, message: 'Este panel es solo para contadores' };
    }
    await setSessionCookie(accessToken);
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError && MENSAJES_LOGIN[e.status]) {
      return { ok: false, status: e.status, message: MENSAJES_LOGIN[e.status] };
    }
    return { ok: false, status: 502, message: MENSAJE_SIN_CONEXION };
  }
}

/** Lee el body JSON de un request; `null` si no es un objeto JSON válido. */
export async function leerCuerpo(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const datos: unknown = await request.json();
    return datos && typeof datos === 'object' ? (datos as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
