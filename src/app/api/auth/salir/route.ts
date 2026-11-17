import type { NextRequest } from 'next/server';

import { rutaSegura } from '@/lib/auth/ruta-segura';
import { clearSessionCookie } from '@/lib/auth/session';

// GET /api/auth/salir?next=<ruta>: borra la cookie y manda al login.
// Existe porque los Server Components no pueden modificar cookies: cuando
// apiFetch recibe un 401 con el token de la cookie, redirige acá.
export async function GET(request: NextRequest) {
  await clearSessionCookie();
  const next = rutaSegura(request.nextUrl.searchParams.get('next'));
  const destino = next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`;
  return new Response(null, {
    status: 307,
    headers: { Location: destino, 'Cache-Control': 'no-store' },
  });
}
