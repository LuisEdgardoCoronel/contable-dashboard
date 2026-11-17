import { NextResponse } from 'next/server';

import { ApiError, apiFetch, MENSAJE_SIN_CONEXION } from '@/lib/api/client';
import type { LoginRespuesta, Perfil } from '@/lib/api/types';
import { setSessionCookie } from '@/lib/auth/session';

const MENSAJES: Record<number, string> = {
  400: 'Revisá los datos',
  401: 'Email o contraseña incorrectos',
  429: 'Demasiados intentos. Esperá un minuto y volvé a probar',
};

function error(status: number, message: string) {
  return NextResponse.json({ message }, { status });
}

export async function POST(request: Request) {
  let datos: unknown;
  try {
    datos = await request.json();
  } catch {
    return error(400, MENSAJES[400]);
  }
  const { email, password } = (datos ?? {}) as Record<string, unknown>;
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return error(400, MENSAJES[400]);
  }

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
      return error(403, 'Este panel es solo para contadores');
    }
    await setSessionCookie(accessToken);
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof ApiError && MENSAJES[e.status]) {
      return error(e.status, MENSAJES[e.status]);
    }
    return error(502, MENSAJE_SIN_CONEXION);
  }
}
