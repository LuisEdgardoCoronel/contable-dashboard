import { NextResponse, type NextRequest } from 'next/server';

import { COOKIE_NAME } from '@/lib/auth/cookie';
import { tokenVigente } from '@/lib/auth/jwt';
import { rutaSegura } from '@/lib/auth/ruta-segura';

// Solo decide redirecciones mirando el `exp` del JWT, sin verificar la firma.
// La validez real la decide la API (401 → apiFetch → /api/auth/salir).
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const haySesion = tokenVigente(request.cookies.get(COOKIE_NAME)?.value);
  // Login y registro: públicas, pero con sesión no tienen sentido.
  const esPublica = pathname === '/login' || pathname === '/registro';

  if (esPublica) {
    if (!haySesion) return NextResponse.next();
    const destino = rutaSegura(request.nextUrl.searchParams.get('next'));
    return NextResponse.redirect(new URL(destino, request.url));
  }

  if (!haySesion) {
    const url = new URL('/login', request.url);
    const next = rutaSegura(pathname + search);
    if (next !== '/') url.searchParams.set('next', next);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Excluye /api/auth/*, los assets de Next y cualquier archivo con extensión (estáticos de public/).
  matcher: ['/((?!api/auth/|_next/static|_next/image|favicon\\.ico|.*\\.[\\w]+$).*)'],
};
