import { clearSessionCookie } from '@/lib/auth/session';

// La API no tiene revocación de tokens: cerrar sesión = borrar la cookie.
// Responde 303 para que el <form method="post"> termine en un GET a /login
// (funciona también sin JavaScript).
export async function POST() {
  await clearSessionCookie();
  return new Response(null, { status: 303, headers: { Location: '/login' } });
}
