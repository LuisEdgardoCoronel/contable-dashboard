'use server';

import { refresh, revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';

import { ApiError, apiFetch, MENSAJE_SIN_CONEXION } from '@/lib/api/client';
import type { ActualizarClienteBody, Cliente, Usuario } from '@/lib/api/types';
import {
  bodyAcceso,
  bodyCliente,
  CAMPOS_ACCESO,
  CAMPOS_CLIENTE,
  esUuid,
  hayErrores,
  leerCampos,
  MENSAJES,
  validarAcceso,
  validarCliente,
  type Aviso,
  type CampoAcceso,
  type CampoCliente,
  type EstadoFormulario,
} from '@/lib/clientes';

// Server Actions de clientes. Todas usan el token de la cookie (`apiFetch` sin
// `token`): un 401 redirige al login, y la API filtra por el adminId del token,
// así que un id ajeno da 404 aunque alguien arme el POST a mano.
//
// Firma para `useActionState`: (estadoPrevio, formData). Las que necesitan el id
// lo reciben primero, con `.bind(null, id)` desde la página.

export type EstadoCliente = EstadoFormulario<CampoCliente>;
export type EstadoAcceso = EstadoFormulario<CampoAcceso>;
/** Baja y reactivación: solo un mensaje general. */
export type EstadoAccion = Pick<EstadoFormulario, 'mensaje'>;

/**
 * Toda action que devuelve un error pasa por acá. `refresh()` hace que Next
 * vuelva a renderizar la página en la misma respuesta, así:
 * - un 409 (p. ej. "El cliente ya tiene acceso") se ve con los datos actuales;
 * - sin JS, Next pasa a la fase de render antes de renderizar la página. Si la
 *   action no revalida, la deja en fase "action" y, en `next dev` (16.4.6),
 *   `cookies()` del layout tira "Invariant: Received an underlying cookies object
 *   that does not match…" (ver CLAUDE.md).
 */
function fallo<E extends EstadoFormulario>(estado: E): E {
  refresh();
  return estado;
}

/**
 * Traduce un error de la API al estado del formulario:
 * 409 → mensaje de la API (en español), en el campo si corresponde;
 * 400 → "Revisá los datos" (class-validator puede responder en inglés);
 * 404 → `notFound()`; el resto → sin conexión.
 * Lo que no es `ApiError` (p. ej. el `redirect()` de un 401) se relanza.
 */
function estadoDeError<C extends string>(
  e: unknown,
  campoDe409: (mensaje: string) => C | undefined,
): EstadoFormulario<C> {
  if (!(e instanceof ApiError)) throw e;
  if (e.status === 404) notFound();
  if (e.status === 409) {
    const campo = campoDe409(e.message);
    return campo
      ? { errores: { [campo]: e.message } as Partial<Record<C, string>> }
      : { mensaje: e.message };
  }
  if (e.status === 400) return { mensaje: MENSAJES.revisar };
  return { mensaje: MENSAJE_SIN_CONEXION };
}

// 409 de clientes: "Ya existe un cliente con ese CUIT".
const campo409Cliente = (m: string): CampoCliente | undefined => (/cuit/i.test(m) ? 'cuit' : undefined);
// 409 de acceso: "El email ya está registrado" va al campo; "ya tiene acceso" y
// "está dado de baja" son mensajes generales.
const campo409Acceso = (m: string): CampoAcceso | undefined => (/email/i.test(m) ? 'email' : undefined);

/** Fuera de cualquier try/catch: `redirect()` lanza. */
function terminar(id: string, aviso: Aviso): never {
  // El panel es no-store, pero el Client Cache del router puede tener el listado
  // o el Inicio de antes: se purga para que vuelvan a pedirse.
  revalidatePath('/', 'layout');
  redirect(`/clientes/${id}?ok=${aviso}`);
}

function validarId(id: string): void {
  if (!esUuid(id)) notFound();
}

export async function crearCliente(_previo: EstadoCliente, formData: FormData): Promise<EstadoCliente> {
  const valores = leerCampos(formData, CAMPOS_CLIENTE);
  const errores = validarCliente(valores);
  if (hayErrores(errores)) return fallo({ errores, valores });

  let creado: Cliente;
  try {
    creado = await apiFetch<Cliente>('/clientes', { method: 'POST', body: bodyCliente(valores) });
  } catch (e) {
    return fallo({ ...estadoDeError(e, campo409Cliente), valores });
  }
  terminar(creado.id, 'creado');
}

export async function actualizarCliente(
  id: string,
  _previo: EstadoCliente,
  formData: FormData,
): Promise<EstadoCliente> {
  validarId(id);
  const valores = leerCampos(formData, CAMPOS_CLIENTE);
  const errores = validarCliente(valores);
  if (hayErrores(errores)) return fallo({ errores, valores });

  try {
    // PUT reemplaza los datos; sin `activo`, el estado no cambia.
    const body: ActualizarClienteBody = bodyCliente(valores);
    await apiFetch<Cliente>(`/clientes/${id}`, { method: 'PUT', body });
  } catch (e) {
    return fallo({ ...estadoDeError(e, campo409Cliente), valores });
  }
  terminar(id, 'editado');
}

// Baja y reactivación no leen el estado previo ni el form (no tienen campos):
// `useActionState` las llama igual con (estadoPrevio, formData).
export async function darDeBaja(id: string): Promise<EstadoAccion> {
  validarId(id);
  try {
    await apiFetch<void>(`/clientes/${id}`, { method: 'DELETE' });
  } catch (e) {
    return fallo(estadoDeError(e, () => undefined));
  }
  terminar(id, 'baja');
}

/** La API no tiene un endpoint de reactivación: se lee el cliente y se reenvía con `activo: true`. */
export async function reactivarCliente(id: string): Promise<EstadoAccion> {
  validarId(id);
  try {
    const actual = await apiFetch<Cliente>(`/clientes/${id}`);
    const body: ActualizarClienteBody = {
      razonSocial: actual.razonSocial,
      cuit: actual.cuit,
      email: actual.email,
      telefono: actual.telefono,
      condicionIVA: actual.condicionIVA,
      activo: true,
    };
    await apiFetch<Cliente>(`/clientes/${id}`, { method: 'PUT', body });
  } catch (e) {
    return fallo(estadoDeError(e, () => undefined));
  }
  terminar(id, 'reactivado');
}

export async function crearAcceso(
  id: string,
  _previo: EstadoAcceso,
  formData: FormData,
): Promise<EstadoAcceso> {
  validarId(id);
  const datos = leerCampos(formData, CAMPOS_ACCESO);
  // La contraseña no vuelve al navegador: se pide de nuevo si hay errores.
  const valores = { email: datos.email, nombre: datos.nombre };
  const errores = validarAcceso(datos);
  if (hayErrores(errores)) return fallo({ errores, valores });

  try {
    await apiFetch<Usuario>(`/clientes/${id}/acceso`, { method: 'POST', body: bodyAcceso(datos) });
  } catch (e) {
    return fallo({ ...estadoDeError(e, campo409Acceso), valores });
  }
  terminar(id, 'acceso');
}
