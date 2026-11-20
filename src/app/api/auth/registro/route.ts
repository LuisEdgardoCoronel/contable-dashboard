import { NextResponse } from 'next/server';

import { ApiError, apiFetch, MENSAJE_SIN_CONEXION } from '@/lib/api/client';
import type { Usuario } from '@/lib/api/types';
import { iniciarSesion, leerCuerpo } from '@/lib/auth/iniciar-sesion';

// Mismos límites que RegisterDto en la API (bcrypt usa solo 72 bytes).
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

const MENSAJES: Record<number, string> = {
  400: 'Revisá los datos',
  409: 'Ese email ya está registrado',
};

/** Cuenta creada, pero el login automático falló: el formulario manda al login. */
const MENSAJE_SIN_SESION =
  'Tu cuenta se creó, pero no pudimos iniciar sesión. Ingresá con tu email y contraseña.';

function error(status: number, message: string) {
  return NextResponse.json({ message }, { status });
}

export async function POST(request: Request) {
  const { nombre, email, password } = (await leerCuerpo(request)) ?? {};
  if (
    typeof nombre !== 'string' ||
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !nombre.trim() ||
    !email.trim()
  ) {
    return error(400, MENSAJES[400]);
  }
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
    return error(400, `La contraseña tiene que tener entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres`);
  }

  try {
    // POST /auth/register siempre crea un admin (un estudio nuevo, vacío).
    await apiFetch<Usuario>('/auth/register', {
      method: 'POST',
      body: { nombre: nombre.trim(), email: email.trim(), password },
      token: null,
    });
  } catch (e) {
    if (e instanceof ApiError && MENSAJES[e.status]) return error(e.status, MENSAJES[e.status]);
    return error(502, MENSAJE_SIN_CONEXION);
  }

  const sesion = await iniciarSesion(email, password);
  if (!sesion.ok) {
    // La cuenta ya existe: no es un error del registro. 201 sin cookie.
    return NextResponse.json({ sesion: false, message: MENSAJE_SIN_SESION }, { status: 201 });
  }
  return NextResponse.json({ sesion: true }, { status: 201 });
}
