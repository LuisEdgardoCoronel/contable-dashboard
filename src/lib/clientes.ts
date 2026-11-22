// Helpers puros de la pantalla de Clientes. Sin `server-only`: los usan las
// páginas y las Server Actions (servidor) y los formularios (cliente). Los
// tipos se importan con `import type`, así no se arrastra `types.ts` al cliente.
import type { ClientesQuery, CondicionIVA, CrearAccesoBody, CrearClienteBody } from '@/lib/api/types';

import { cuitValido, normalizarCuit } from './cuit';
import { leerPagina, leerParametro as leer, POR_PAGINA, type Params } from './paginacion';

// ---------------------------------------------------------------------------
// Condición frente al IVA

export const CONDICIONES_IVA: readonly { valor: CondicionIVA; etiqueta: string }[] = [
  { valor: 'responsable_inscripto', etiqueta: 'Responsable inscripto' },
  { valor: 'monotributista', etiqueta: 'Monotributista' },
  { valor: 'exento', etiqueta: 'Exento' },
  { valor: 'consumidor_final', etiqueta: 'Consumidor final' },
  { valor: 'no_alcanzado', etiqueta: 'No alcanzado' },
];

export function esCondicionIVA(valor: string): valor is CondicionIVA {
  return CONDICIONES_IVA.some((c) => c.valor === valor);
}

/** Texto de la condición; si la API mandara un valor desconocido, lo muestra tal cual. */
export function etiquetaCondicionIVA(valor: string): string {
  return CONDICIONES_IVA.find((c) => c.valor === valor)?.etiqueta ?? valor;
}

// ---------------------------------------------------------------------------
// Filtros y paginación del listado (viven en la URL)

/** La API rechaza (400) un `search` de más de 100 caracteres. */
export const BUSCAR_MAX = 100;

export const ESTADOS_FILTRO = ['activos', 'baja', 'todos'] as const;
export type EstadoFiltro = (typeof ESTADOS_FILTRO)[number];
export const ESTADO_FILTRO_DEFAULT: EstadoFiltro = 'activos';

export const ETIQUETA_ESTADO_FILTRO: Record<EstadoFiltro, string> = {
  activos: 'Activos',
  baja: 'Dados de baja',
  todos: 'Todos',
};

export interface FiltrosClientes {
  buscar?: string;
  estado: EstadoFiltro;
  pagina: number;
}

/**
 * Lee `buscar`, `estado` y `pagina` de los `searchParams`. Un valor repetido
 * toma el primero. `estado` inválido → `activos`; `pagina` que no sea un entero
 * ≥ 1 → 1. `buscar` se recorta a 100 caracteres (el máximo de la API).
 */
export function leerFiltrosClientes(params: Params): FiltrosClientes {
  const buscar = leer(params, 'buscar')?.slice(0, BUSCAR_MAX).trim() || undefined;

  const estadoPedido = leer(params, 'estado');
  const estado = ESTADOS_FILTRO.find((e) => e === estadoPedido) ?? ESTADO_FILTRO_DEFAULT;

  return { buscar, estado, pagina: leerPagina(params) };
}

/** Traduce los filtros de la URL a la query de `GET /clientes`. */
export function queryClientes(filtros: FiltrosClientes): ClientesQuery {
  return {
    search: filtros.buscar,
    activo: filtros.estado === 'todos' ? undefined : filtros.estado === 'activos',
    page: filtros.pagina,
    limit: POR_PAGINA,
  };
}

/** `true` si hay algún filtro distinto del default (sin contar la página). */
export function hayFiltros(filtros: FiltrosClientes): boolean {
  return Boolean(filtros.buscar) || filtros.estado !== ESTADO_FILTRO_DEFAULT;
}

/** URL del listado con esos filtros. Omite los valores por defecto. */
export function urlClientes(filtros: Partial<FiltrosClientes>): string {
  const query = new URLSearchParams();
  const buscar = filtros.buscar?.trim();
  if (buscar) query.set('buscar', buscar);
  if (filtros.estado && filtros.estado !== ESTADO_FILTRO_DEFAULT) query.set('estado', filtros.estado);
  if (filtros.pagina && filtros.pagina > 1) query.set('pagina', String(filtros.pagina));
  const qs = query.toString();
  return qs ? `/clientes?${qs}` : '/clientes';
}

// ---------------------------------------------------------------------------
// Avisos

export const AVISOS = {
  creado: 'Cliente creado',
  editado: 'Cambios guardados',
  baja: 'Cliente dado de baja',
  reactivado: 'Cliente reactivado',
  acceso: 'Acceso creado',
} as const;
export type Aviso = keyof typeof AVISOS;

/** Texto del aviso `?ok=` del detalle, o `undefined` si falta o no es conocido. */
export function leerAviso(params: Params): string | undefined {
  const ok = leer(params, 'ok');
  return ok && Object.hasOwn(AVISOS, ok) ? AVISOS[ok as Aviso] : undefined;
}

// ---------------------------------------------------------------------------
// Formularios: validación (lo genérico está en `formularios.ts`)

export const CAMPOS_CLIENTE = ['razonSocial', 'cuit', 'email', 'telefono', 'condicionIVA'] as const;
export type CampoCliente = (typeof CAMPOS_CLIENTE)[number];
export type DatosCliente = Record<CampoCliente, string>;

export const CAMPOS_ACCESO = ['email', 'password', 'nombre'] as const;
export type CampoAcceso = (typeof CAMPOS_ACCESO)[number];
export type DatosAcceso = Record<CampoAcceso, string>;

export const MENSAJES_CLIENTE = {
  razonSocial: 'Ingresá la razón social',
  razonSocialLarga: 'La razón social puede tener hasta 255 caracteres',
  cuit: 'El CUIT no es válido',
  email: 'Ingresá un email válido',
  telefono: 'El teléfono puede tener hasta 50 caracteres',
  condicionIVA: 'Elegí una condición frente al IVA',
  password: 'La contraseña tiene que tener entre 8 y 72 caracteres',
  nombreLargo: 'El nombre puede tener hasta 255 caracteres',
} as const;

const TEXTO_MAX = 255;
const TELEFONO_MAX = 50;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;
// Chequeo básico; la API (IsEmail) es más estricta y un rechazo suyo da "Revisá los datos".
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailValido(email: string): boolean {
  const e = email.trim();
  return e.length <= TEXTO_MAX && EMAIL.test(e);
}

/** Errores por campo, en español. Objeto vacío si todo está bien. */
export function validarCliente(datos: DatosCliente): Partial<Record<CampoCliente, string>> {
  const errores: Partial<Record<CampoCliente, string>> = {};
  const razonSocial = datos.razonSocial.trim();
  if (!razonSocial) errores.razonSocial = MENSAJES_CLIENTE.razonSocial;
  else if (razonSocial.length > TEXTO_MAX) errores.razonSocial = MENSAJES_CLIENTE.razonSocialLarga;
  if (!cuitValido(datos.cuit.trim())) errores.cuit = MENSAJES_CLIENTE.cuit;
  if (!emailValido(datos.email)) errores.email = MENSAJES_CLIENTE.email;
  if (datos.telefono.trim().length > TELEFONO_MAX) errores.telefono = MENSAJES_CLIENTE.telefono;
  if (!esCondicionIVA(datos.condicionIVA)) errores.condicionIVA = MENSAJES_CLIENTE.condicionIVA;
  return errores;
}

/** Body para `POST`/`PUT /clientes` (llamar después de `validarCliente`). Teléfono vacío → `null`. */
export function bodyCliente(datos: DatosCliente): CrearClienteBody {
  return {
    razonSocial: datos.razonSocial.trim(),
    cuit: normalizarCuit(datos.cuit.trim()),
    email: datos.email.trim(),
    telefono: datos.telefono.trim() || null,
    condicionIVA: datos.condicionIVA as CondicionIVA,
  };
}

export function validarAcceso(datos: DatosAcceso): Partial<Record<CampoAcceso, string>> {
  const errores: Partial<Record<CampoAcceso, string>> = {};
  if (!emailValido(datos.email)) errores.email = MENSAJES_CLIENTE.email;
  // Sin trim: la contraseña se manda tal cual.
  if (datos.password.length < PASSWORD_MIN || datos.password.length > PASSWORD_MAX) {
    errores.password = MENSAJES_CLIENTE.password;
  }
  if (datos.nombre.trim().length > TEXTO_MAX) errores.nombre = MENSAJES_CLIENTE.nombreLargo;
  return errores;
}

/** Body para `POST /clientes/:id/acceso`. Nombre vacío → se omite (la API usa la razón social). */
export function bodyAcceso(datos: DatosAcceso): CrearAccesoBody {
  const nombre = datos.nombre.trim();
  return { email: datos.email.trim(), password: datos.password, ...(nombre ? { nombre } : {}) };
}
