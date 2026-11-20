import { mkdirSync } from 'node:fs';
import path from 'node:path';

const REQUERIDAS = [
  'E2E_API_URL',
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
  'E2E_ADMIN_NOMBRE',
  'E2E_CLIENTE_EMAIL',
  'E2E_CLIENTE_PASSWORD',
] as const;

type Clave = (typeof REQUERIDAS)[number];

export function leerEnv(): Record<Clave, string> {
  const faltan = REQUERIDAS.filter((k) => !process.env[k]);
  if (faltan.length > 0) {
    throw new Error(
      `Faltan variables en .env.test: ${faltan.join(', ')}. Copiá .env.test.example a .env.test.`,
    );
  }
  return Object.fromEntries(REQUERIDAS.map((k) => [k, process.env[k]!])) as Record<Clave, string>;
}

export const MENSAJE_429 =
  'La API devolvió 429 (rate limit del login: LOGIN_RATE_LIMIT intentos por minuto por IP, default 5; ' +
  'la suite usa 6, así que el default no alcanza). ' +
  'Subí LOGIN_RATE_LIMIT en el .env de la API ' +
  '(p. ej. 100) y reiniciala.';

export const RUTA_SESION_ADMIN = path.join(__dirname, '.auth', 'admin.json');

export function asegurarCarpetaAuth() {
  mkdirSync(path.dirname(RUTA_SESION_ADMIN), { recursive: true });
}
