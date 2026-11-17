import 'server-only';

import { cookies } from 'next/headers';
import { cache } from 'react';

import { apiFetch } from '@/lib/api/client';
import type { Perfil } from '@/lib/api/types';

import { COOKIE_NAME } from './cookie';
import { leerExpiracion } from './jwt';

export { COOKIE_NAME };
const MAX_AGE_FALLBACK_SEG = 60 * 60 * 24; // 1 día

function opcionesBase() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  };
}

/** Segundos hasta el `exp` del JWT; si no se puede leer, 1 día. */
function maxAgeDelToken(token: string): number {
  const exp = leerExpiracion(token);
  if (exp === null) return MAX_AGE_FALLBACK_SEG;
  return Math.max(0, Math.floor(exp - Date.now() / 1000));
}

/** Solo en Route Handlers o Server Actions. */
export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, token, { ...opcionesBase(), maxAge: maxAgeDelToken(token) });
}

/** Solo en Route Handlers o Server Actions (logout y /api/auth/salir). */
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, '', { ...opcionesBase(), maxAge: 0 });
}

export async function getToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(COOKIE_NAME)?.value || undefined;
}

/** Perfil del usuario logueado. Memorizado por request: layout y página comparten la llamada. */
export const getPerfil = cache(async (): Promise<Perfil> => apiFetch<Perfil>('/auth/me'));
