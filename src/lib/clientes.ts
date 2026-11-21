// Helpers puros de la pantalla de Clientes. Sin `server-only`: los usan las
// páginas y las Server Actions (servidor) y los formularios (cliente). Los
// tipos se importan con `import type`, así no se arrastra `types.ts` al cliente.
import type { ClientesQuery, CondicionIVA, CrearAccesoBody, CrearClienteBody } from '@/lib/api/types';

import { cuitValido, normalizarCuit } from './cuit';

type Params = Record<string, string | string[] | undefined>;

/** Primer valor de un parámetro (repetido → el primero), recortado; vacío → `undefined`. */
function leer(params: Params, clave: string): string | undefined {
  const v = params[clave];
  const valor = (Array.isArray(v) ? v[0] : v)?.trim();
  return valor ? valor : undefined;
}

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

export const POR_PAGINA = 20;
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

  const paginaPedida = leer(params, 'pagina');
  const numero = paginaPedida && /^\d+$/.test(paginaPedida) ? Number(paginaPedida) : NaN;
  const pagina = Number.isSafeInteger(numero) && numero >= 1 ? numero : 1;

  return { buscar, estado, pagina };
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

export interface Paginacion {
  totalPaginas: number;
  hayAnterior: boolean;
  haySiguiente: boolean;
}

/** Con 0 resultados hay 1 página (vacía). Una página fuera de rango no tiene "Siguiente". */
export function calcularPaginacion(total: number, pagina: number, porPagina = POR_PAGINA): Paginacion {
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  return {
    totalPaginas,
    hayAnterior: pagina > 1,
    haySiguiente: pagina < totalPaginas,
  };
}

// ---------------------------------------------------------------------------
// Identificadores y avisos

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La API responde 400 a un `:id` que no es UUID: se chequea antes y se trata como no encontrado. */
export function esUuid(valor: string): boolean {
  return UUID.test(valor);
}

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
// Formularios: estado de las Server Actions y validación

/** Lo que devuelven las Server Actions a `useActionState`. */
export interface EstadoFormulario<C extends string = string> {
  errores?: Partial<Record<C, string>>;
  /** Error general (no asociado a un campo). */
  mensaje?: string;
  /** Lo que se envió, para volver a llenar el formulario (React lo resetea después de la action). */
  valores?: Partial<Record<C, string>>;
}

export const CAMPOS_CLIENTE = ['razonSocial', 'cuit', 'email', 'telefono', 'condicionIVA'] as const;
export type CampoCliente = (typeof CAMPOS_CLIENTE)[number];
export type DatosCliente = Record<CampoCliente, string>;

export const CAMPOS_ACCESO = ['email', 'password', 'nombre'] as const;
export type CampoAcceso = (typeof CAMPOS_ACCESO)[number];
export type DatosAcceso = Record<CampoAcceso, string>;

export const MENSAJES = {
  revisar: 'Revisá los datos',
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

/** Lee los campos de un `FormData` como strings (un campo ausente o un archivo → `''`). */
export function leerCampos<C extends string>(formData: FormData, campos: readonly C[]): Record<C, string> {
  return Object.fromEntries(
    campos.map((c) => {
      const v = formData.get(c);
      return [c, typeof v === 'string' ? v : ''];
    }),
  ) as Record<C, string>;
}

/** Errores por campo, en español. Objeto vacío si todo está bien. */
export function validarCliente(datos: DatosCliente): Partial<Record<CampoCliente, string>> {
  const errores: Partial<Record<CampoCliente, string>> = {};
  const razonSocial = datos.razonSocial.trim();
  if (!razonSocial) errores.razonSocial = MENSAJES.razonSocial;
  else if (razonSocial.length > TEXTO_MAX) errores.razonSocial = MENSAJES.razonSocialLarga;
  if (!cuitValido(datos.cuit.trim())) errores.cuit = MENSAJES.cuit;
  if (!emailValido(datos.email)) errores.email = MENSAJES.email;
  if (datos.telefono.trim().length > TELEFONO_MAX) errores.telefono = MENSAJES.telefono;
  if (!esCondicionIVA(datos.condicionIVA)) errores.condicionIVA = MENSAJES.condicionIVA;
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
  if (!emailValido(datos.email)) errores.email = MENSAJES.email;
  // Sin trim: la contraseña se manda tal cual.
  if (datos.password.length < PASSWORD_MIN || datos.password.length > PASSWORD_MAX) {
    errores.password = MENSAJES.password;
  }
  if (datos.nombre.trim().length > TEXTO_MAX) errores.nombre = MENSAJES.nombreLargo;
  return errores;
}

/** Body para `POST /clientes/:id/acceso`. Nombre vacío → se omite (la API usa la razón social). */
export function bodyAcceso(datos: DatosAcceso): CrearAccesoBody {
  const nombre = datos.nombre.trim();
  return { email: datos.email.trim(), password: datos.password, ...(nombre ? { nombre } : {}) };
}

export function hayErrores(errores: Record<string, string | undefined>): boolean {
  return Object.values(errores).some(Boolean);
}
