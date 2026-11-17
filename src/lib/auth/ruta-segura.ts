// Sin `server-only`: lo usan el proxy, los route handlers y el formulario de
// login (componente cliente). Es una función pura, sin secretos.

/**
 * Devuelve `next` solo si es una ruta interna (`/algo`). Rechaza URLs absolutas,
 * protocol-relative (`//evil.com`) y `/\evil.com` (los navegadores tratan `\`
 * como `/`). Cualquier otra cosa → `/`.
 */
export function rutaSegura(next: string | null | undefined): string {
  if (typeof next !== 'string' || next === '') return '/';
  if (!next.startsWith('/')) return '/';
  if (next.startsWith('//') || next.startsWith('/\\')) return '/';
  // Caracteres de control (tab, salto de línea): el parser de URL los descarta
  // y "/\t/evil.com" terminaría siendo "//evil.com".
  if (/[\u0000-\u001f\u007f]/.test(next)) return '/';
  return next;
}
