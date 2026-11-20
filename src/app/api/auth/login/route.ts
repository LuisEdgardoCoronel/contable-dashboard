import { NextResponse } from 'next/server';

import { iniciarSesion, leerCuerpo } from '@/lib/auth/iniciar-sesion';

function error(status: number, message: string) {
  return NextResponse.json({ message }, { status });
}

export async function POST(request: Request) {
  const { email, password } = (await leerCuerpo(request)) ?? {};
  // Validar antes de llamar a la API: un body vacío no gasta un intento del rate limit.
  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return error(400, 'Revisá los datos');
  }

  const resultado = await iniciarSesion(email, password);
  if (!resultado.ok) return error(resultado.status, resultado.message);
  return new NextResponse(null, { status: 204 });
}
