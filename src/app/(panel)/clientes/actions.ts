'use server';

import { estadoDeError, fallo, terminar, validarId } from '@/lib/acciones';
import { apiFetch } from '@/lib/api/client';
import type { ActualizarClienteBody, Cliente, Usuario } from '@/lib/api/types';
import {
  bodyAcceso,
  bodyCliente,
  CAMPOS_ACCESO,
  CAMPOS_CLIENTE,
  validarAcceso,
  validarCliente,
  type Aviso,
  type CampoAcceso,
  type CampoCliente,
} from '@/lib/clientes';
import { hayErrores, leerCampos, type EstadoAccion, type EstadoFormulario } from '@/lib/formularios';

// Server Actions de clientes. Todas usan el token de la cookie (`apiFetch` sin
// `token`): un 401 redirige al login, y la API filtra por el adminId del token,
// así que un id ajeno da 404 aunque alguien arme el POST a mano.
//
// Firma para `useActionState`: (estadoPrevio, formData). Las que necesitan el id
// lo reciben primero, con `.bind(null, id)` desde la página.
//
// Los helpers (`fallo`, `estadoDeError`, `terminar`, `validarId`) están en
// `lib/acciones.ts`: un archivo `'use server'` solo puede exportar funciones async.

export type EstadoCliente = EstadoFormulario<CampoCliente>;
export type EstadoAcceso = EstadoFormulario<CampoAcceso>;

// 409 de clientes: "Ya existe un cliente con ese CUIT".
const campo409Cliente = (m: string): CampoCliente | undefined => (/cuit/i.test(m) ? 'cuit' : undefined);
// 409 de acceso: "El email ya está registrado" va al campo; "ya tiene acceso" y
// "está dado de baja" son mensajes generales.
const campo409Acceso = (m: string): CampoAcceso | undefined => (/email/i.test(m) ? 'email' : undefined);

/** Al detalle del cliente con su aviso. Fuera de cualquier try/catch: `redirect()` lanza. */
function alDetalle(id: string, aviso: Aviso): never {
  terminar(`/clientes/${id}?ok=${aviso}`);
}

export async function crearCliente(_previo: EstadoCliente, formData: FormData): Promise<EstadoCliente> {
  const valores = leerCampos(formData, CAMPOS_CLIENTE);
  const errores = validarCliente(valores);
  if (hayErrores(errores)) return fallo({ errores, valores });

  let creado: Cliente;
  try {
    creado = await apiFetch<Cliente>('/clientes', { method: 'POST', body: bodyCliente(valores) });
  } catch (e) {
    return fallo({ ...estadoDeError(e, { campoDe409: campo409Cliente }), valores });
  }
  alDetalle(creado.id, 'creado');
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
    return fallo({ ...estadoDeError(e, { campoDe409: campo409Cliente }), valores });
  }
  alDetalle(id, 'editado');
}

// Baja y reactivación no leen el estado previo ni el form (no tienen campos):
// `useActionState` las llama igual con (estadoPrevio, formData).
export async function darDeBaja(id: string): Promise<EstadoAccion> {
  validarId(id);
  try {
    await apiFetch<void>(`/clientes/${id}`, { method: 'DELETE' });
  } catch (e) {
    return fallo(estadoDeError(e));
  }
  alDetalle(id, 'baja');
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
    return fallo(estadoDeError(e));
  }
  alDetalle(id, 'reactivado');
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
    return fallo({ ...estadoDeError(e, { campoDe409: campo409Acceso }), valores });
  }
  alDetalle(id, 'acceso');
}
