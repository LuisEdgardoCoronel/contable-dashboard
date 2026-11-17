// Lectura del `exp` de un JWT SIN verificar la firma. Solo sirve para decidir
// redirecciones y el maxAge de la cookie; la validez real la decide la API.
// Sin `server-only`: lo usa el proxy y no depende de nada del servidor.

export function leerExpiracion(token: string): number | null {
  const partes = token.split('.');
  if (partes.length !== 3 || !partes[1]) return null;
  try {
    const payload: unknown = JSON.parse(decodificarBase64Url(partes[1]));
    if (payload && typeof payload === 'object' && 'exp' in payload) {
      const { exp } = payload as { exp: unknown };
      if (typeof exp === 'number' && Number.isFinite(exp)) return exp;
    }
    return null;
  } catch {
    return null;
  }
}

/** Un token sin `exp` legible o ya vencido se trata como ausente. */
export function tokenVigente(token: string | undefined, ahoraSeg = Date.now() / 1000): boolean {
  if (!token) return false;
  const exp = leerExpiracion(token);
  return exp !== null && exp > ahoraSeg;
}

function decodificarBase64Url(valor: string): string {
  const base64 = valor.replace(/-/g, '+').replace(/_/g, '/');
  const conRelleno = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binario = atob(conRelleno);
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
