'use server';

import { estadoDeError, fallo, terminar, validarId } from '@/lib/acciones';
import { ApiError, apiFetch, MENSAJE_SIN_CONEXION } from '@/lib/api/client';
import type { ActualizarVencimientoBody, Impuesto, Vencimiento } from '@/lib/api/types';
import { listarImpuestos } from '@/lib/api/vencimientos';
import { hoyArgentina } from '@/lib/fechas';
import { hayErrores, leerCampos, type EstadoAccion, type EstadoFormulario } from '@/lib/formularios';
import {
  bodyVencimiento,
  CAMPOS_VENCIMIENTO,
  MENSAJES_VENCIMIENTO,
  normalizarNotas,
  urlConAviso,
  validarFechaVencimiento,
  validarNotas,
  validarPresentacion,
  validarVencimiento,
  type AvisoVencimiento,
  type CampoVencimiento,
} from '@/lib/vencimientos';

// Server Actions de vencimientos. Mismo patrón que las de clientes: token de la
// cookie, la API filtra por el adminId (un id ajeno da 404), `fallo()` en todo
// retorno con error y `terminar()` fuera del try (ver `lib/acciones.ts`).
//
// Firma para `useActionState`: (estadoPrevio, formData). Las que necesitan el id
// lo reciben primero, con `.bind(null, id)` desde la página.

export type EstadoVencimientoForm = EstadoFormulario<CampoVencimiento>;
export type EstadoPresentacion = EstadoFormulario<'fechaPresentacion'>;
export type EstadoNotas = EstadoFormulario<'notas'>;
export type EstadoFechaVencimiento = EstadoFormulario<'fechaVencimiento'>;

// 409 del alta: "El cliente está dado de baja" va al cliente; "Ya existe un
// vencimiento de ese impuesto para ese cliente y período", al período.
const campo409Alta = (m: string): CampoVencimiento | undefined =>
  /dado de baja/i.test(m) ? 'clienteId' : /ya existe/i.test(m) ? 'periodo' : undefined;

// 404 del alta: el cliente o el impuesto ya no existen ("Cliente no encontrado",
// "Impuesto no encontrado"). Va al campo, no a `notFound()`: la página existe.
const en404Alta = (m: string): EstadoVencimientoForm => ({
  errores: { [/impuesto/i.test(m) ? 'impuestoId' : 'clienteId']: m },
});

/** Al detalle con su aviso. Fuera de cualquier try/catch: `redirect()` lanza. */
function alDetalle(id: string, aviso: AvisoVencimiento): never {
  terminar(`/vencimientos/${id}?ok=${aviso}`);
}

function actualizar(id: string, body: ActualizarVencimientoBody): Promise<Vencimiento> {
  return apiFetch<Vencimiento>(`/vencimientos/${id}`, { method: 'PATCH', body });
}

export async function crearVencimiento(
  _previo: EstadoVencimientoForm,
  formData: FormData,
): Promise<EstadoVencimientoForm> {
  const valores = leerCampos(formData, CAMPOS_VENCIMIENTO);

  // La periodicidad de cada impuesto sale de la API: el período se valida contra ella.
  let impuestos: Impuesto[];
  try {
    impuestos = await listarImpuestos();
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    return fallo({ mensaje: MENSAJE_SIN_CONEXION, valores });
  }
  const errores = validarVencimiento(valores, impuestos);
  if (hayErrores(errores)) return fallo({ errores, valores });

  let creado: Vencimiento;
  try {
    creado = await apiFetch<Vencimiento>('/vencimientos', { method: 'POST', body: bodyVencimiento(valores) });
  } catch (e) {
    return fallo({ ...estadoDeError(e, { campoDe409: campo409Alta, en404: en404Alta }), valores });
  }
  alDetalle(creado.id, 'creado');
}

export async function marcarPresentado(
  id: string,
  _previo: EstadoPresentacion,
  formData: FormData,
): Promise<EstadoPresentacion> {
  validarId(id);
  const { fechaPresentacion } = leerCampos(formData, ['fechaPresentacion']);
  const valores = { fechaPresentacion };
  const error = validarPresentacion(fechaPresentacion, hoyArgentina());
  if (error) return fallo({ errores: { fechaPresentacion: error }, valores });

  try {
    // Vacía: no se manda y la API usa la fecha de hoy (Argentina).
    const fecha = fechaPresentacion.trim();
    await actualizar(id, { estado: 'presentado', ...(fecha ? { fechaPresentacion: fecha } : {}) });
  } catch (e) {
    return fallo({ ...estadoDeError<'fechaPresentacion'>(e), valores });
  }
  alDetalle(id, 'presentado');
}

/**
 * "Marcar como presentado" desde una fila del listado: con la fecha de hoy en
 * Argentina, calculada acá. Vuelve al mismo listado (pestaña, filtros y página)
 * con el aviso. `volverA` = `urlVencimientos(filtros)`, con `.bind` desde la página.
 */
export async function presentarDesdeListado(id: string, volverA: string): Promise<EstadoAccion> {
  validarId(id);
  try {
    await actualizar(id, { estado: 'presentado', fechaPresentacion: hoyArgentina() });
  } catch (e) {
    // Un 404 (p. ej. borrado en otra pestaña) va en la fila: notFound() taparía todo el listado.
    return fallo(estadoDeError(e, { en404: () => ({ mensaje: MENSAJES_VENCIMIENTO.noExiste }) }));
  }
  terminar(urlConAviso(volverA, 'presentado'));
}

// Sin campos: `useActionState` la llama igual con (estadoPrevio, formData).
export async function volverAPendiente(id: string): Promise<EstadoAccion> {
  validarId(id);
  try {
    await actualizar(id, { estado: 'pendiente' });
  } catch (e) {
    return fallo(estadoDeError(e));
  }
  alDetalle(id, 'pendiente');
}

export async function guardarNotas(id: string, _previo: EstadoNotas, formData: FormData): Promise<EstadoNotas> {
  validarId(id);
  const { notas } = leerCampos(formData, ['notas']);
  const valores = { notas };
  const error = validarNotas(notas);
  if (error) return fallo({ errores: { notas: error }, valores });

  try {
    // Vacías → null: la API borra las notas.
    await actualizar(id, { notas: normalizarNotas(notas).trim() || null });
  } catch (e) {
    return fallo({ ...estadoDeError<'notas'>(e), valores });
  }
  alDetalle(id, 'notas');
}

/** No toca `fechaPresentacion`; el `estadoActual` lo recalcula la API con la fecha nueva. */
export async function cambiarFechaVencimiento(
  id: string,
  _previo: EstadoFechaVencimiento,
  formData: FormData,
): Promise<EstadoFechaVencimiento> {
  validarId(id);
  const { fechaVencimiento } = leerCampos(formData, ['fechaVencimiento']);
  const valores = { fechaVencimiento };
  const error = validarFechaVencimiento(fechaVencimiento);
  if (error) return fallo({ errores: { fechaVencimiento: error }, valores });

  try {
    await actualizar(id, { fechaVencimiento: fechaVencimiento.trim() });
  } catch (e) {
    return fallo({ ...estadoDeError<'fechaVencimiento'>(e), valores });
  }
  alDetalle(id, 'fecha');
}

export async function borrarVencimiento(id: string): Promise<EstadoAccion> {
  validarId(id);
  try {
    await apiFetch<void>(`/vencimientos/${id}`, { method: 'DELETE' });
  } catch (e) {
    return fallo(estadoDeError(e));
  }
  terminar('/vencimientos?ok=borrado');
}
