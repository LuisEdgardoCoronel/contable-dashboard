import 'server-only';

import { refresh, revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';

import { ApiError, MENSAJE_SIN_CONEXION } from '@/lib/api/client';

import { MENSAJES, type EstadoFormulario } from './formularios';
import { esUuid } from './paginacion';

// Helpers de las Server Actions del panel. No pueden vivir en un archivo
// `'use server'`: ahí solo se exportan funciones async.

/**
 * Toda action que devuelve un error pasa por acá. `refresh()` hace que Next
 * vuelva a renderizar la página en la misma respuesta, así:
 * - un 409 (p. ej. "El cliente ya tiene acceso") se ve con los datos actuales;
 * - sin JS, Next pasa a la fase de render antes de renderizar la página. Si la
 *   action no revalida, la deja en fase "action" y, en `next dev` (16.4.6),
 *   `cookies()` del layout tira "Invariant: Received an underlying cookies object
 *   that does not match…" (ver CLAUDE.md).
 */
export function fallo<E extends EstadoFormulario>(estado: E): E {
  refresh();
  return estado;
}

export interface OpcionesError<C extends string> {
  /** Campo donde va el mensaje de un 409; `undefined` → mensaje general. */
  campoDe409?: (mensaje: string) => C | undefined;
  /** Qué hacer con un 404. Por defecto, `notFound()`. */
  en404?: (mensaje: string) => EstadoFormulario<C>;
}

/**
 * Traduce un error de la API al estado del formulario:
 * 409 → mensaje de la API (en español), en el campo si corresponde;
 * 400 → "Revisá los datos" (class-validator puede responder en inglés);
 * 404 → `en404`, o `notFound()`; el resto → sin conexión.
 * Lo que no es `ApiError` (p. ej. el `redirect()` de un 401) se relanza.
 */
export function estadoDeError<C extends string>(
  e: unknown,
  { campoDe409, en404 }: OpcionesError<C> = {},
): EstadoFormulario<C> {
  if (!(e instanceof ApiError)) throw e;
  if (e.status === 404) {
    if (en404) return en404(e.message);
    notFound();
  }
  if (e.status === 409) {
    const campo = campoDe409?.(e.message);
    return campo
      ? { errores: { [campo]: e.message } as Partial<Record<C, string>> }
      : { mensaje: e.message };
  }
  if (e.status === 400) return { mensaje: MENSAJES.revisar };
  return { mensaje: MENSAJE_SIN_CONEXION };
}

/** Fuera de cualquier try/catch: `redirect()` lanza. */
export function terminar(url: string): never {
  // El panel es no-store, pero el Client Cache del router puede tener el listado
  // o el Inicio de antes: se purga para que vuelvan a pedirse.
  revalidatePath('/', 'layout');
  redirect(url);
}

/** Un id que no es UUID (la API daría 400) se trata como no encontrado. */
export function validarId(id: string): void {
  if (!esUuid(id)) notFound();
}
