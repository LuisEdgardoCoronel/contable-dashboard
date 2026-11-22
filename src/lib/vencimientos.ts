// Helpers puros de la pantalla de Vencimientos. Sin `server-only`: los usan las
// páginas y las Server Actions (servidor) y los formularios (cliente). Los
// tipos se importan con `import type`, así no se arrastra `types.ts` al cliente.
import type {
  CrearVencimientoBody,
  EstadoVencimiento,
  Estadisticas,
  Impuesto,
  VencimientosQuery,
} from '@/lib/api/types';

import { fechaValida, formatearMes } from './fechas';
import { esUuid, leerPagina, leerParametro as leer, POR_PAGINA, type Params } from './paginacion';

export type Periodicidad = Impuesto['periodicidad'];

// ---------------------------------------------------------------------------
// Estado de un vencimiento (siempre `estadoActual` de la API; nunca se recalcula)

export const ESTADO_VENCIMIENTO: Record<EstadoVencimiento, { etiqueta: string; color: string }> = {
  pendiente: { etiqueta: 'Pendiente', color: 'bg-estado-pendiente' },
  vencido: { etiqueta: 'Vencido', color: 'bg-estado-vencido' },
  presentado: { etiqueta: 'Presentado', color: 'bg-estado-presentado' },
};

/** `2026-10` → `octubre 2026`; un período anual (`2025`) queda igual. */
export function formatearPeriodo(periodo: string): string {
  return /^\d{4}$/.test(periodo) ? periodo : formatearMes(periodo);
}

// ---------------------------------------------------------------------------
// Pestañas, filtros y paginación del listado (viven en la URL)

/** En el orden en que se muestran. `pendiente` = al día (no vencido), como en la API. */
export const PESTANAS = ['vencido', 'pendiente', 'proximos', 'presentado', 'todos'] as const;
export type Pestana = (typeof PESTANAS)[number];
export const PESTANA_DEFAULT: Pestana = 'pendiente';

export const ETIQUETA_PESTANA: Record<Pestana, string> = {
  vencido: 'Vencidos',
  pendiente: 'Pendientes',
  proximos: 'Próximos 30 días',
  presentado: 'Presentados',
  todos: 'Todos',
};

/** Texto de una pestaña vacía sin otros filtros. */
export const VACIO_PESTANA: Record<Pestana, string> = {
  vencido: 'No hay vencidos',
  pendiente: 'No hay pendientes al día',
  proximos: 'No hay vencimientos en los próximos 30 días',
  presentado: 'Todavía no hay presentados',
  todos: 'No hay vencimientos',
};

export interface FiltrosVencimientos {
  estado: Pestana;
  cliente?: string;
  impuesto?: string;
  desde?: string;
  hasta?: string;
  pagina: number;
}

export interface LecturaFiltros {
  filtros: FiltrosVencimientos;
  /** Si `desde`/`hasta` no son válidas: el mensaje, y no se llama a la API. */
  errorFechas?: string;
}

/** Valida el rango sin `new Date()`: formato, que el día exista y `desde ≤ hasta` (comparando los strings). */
function errorDeFechas(desde?: string, hasta?: string): string | undefined {
  if (desde && !fechaValida(desde)) return 'Revisá las fechas: "Desde" no es una fecha válida';
  if (hasta && !fechaValida(hasta)) return 'Revisá las fechas: "Hasta" no es una fecha válida';
  if (desde && hasta && desde > hasta) return 'Revisá las fechas: "Desde" no puede ser posterior a "Hasta"';
  return undefined;
}

/**
 * Lee `estado`, `cliente`, `impuesto`, `desde`, `hasta` y `pagina`. Un valor
 * repetido toma el primero. `estado` inválido → `pendiente`; `pagina` inválida
 * → 1; un `cliente` o `impuesto` que no es UUID se ignora (la API daría 400).
 * En `proximos` se ignoran cliente, impuesto y fechas: `/vencimientos/proximos`
 * no los acepta.
 */
export function leerFiltrosVencimientos(params: Params): LecturaFiltros {
  const estadoPedido = leer(params, 'estado');
  const estado = PESTANAS.find((p) => p === estadoPedido) ?? PESTANA_DEFAULT;
  const pagina = leerPagina(params);
  if (estado === 'proximos') return { filtros: { estado, pagina } };

  const uuid = (clave: string) => {
    const v = leer(params, clave);
    return v && esUuid(v) ? v : undefined;
  };
  const desde = leer(params, 'desde');
  const hasta = leer(params, 'hasta');
  return {
    filtros: { estado, cliente: uuid('cliente'), impuesto: uuid('impuesto'), desde, hasta, pagina },
    errorFechas: errorDeFechas(desde, hasta),
  };
}

/** `true` si hay cliente, impuesto o fechas (sin contar la pestaña ni la página). */
export function hayFiltros(filtros: FiltrosVencimientos): boolean {
  return Boolean(filtros.cliente || filtros.impuesto || filtros.desde || filtros.hasta);
}

export interface ConsultaVencimientos {
  ruta: '/vencimientos' | '/vencimientos/proximos';
  query: VencimientosQuery;
}

/** Endpoint y query de la API para esos filtros. "Próximos" va a `/vencimientos/proximos` solo con `page`/`limit`. */
export function consultaVencimientos(filtros: FiltrosVencimientos): ConsultaVencimientos {
  const paginado = { page: filtros.pagina, limit: POR_PAGINA };
  if (filtros.estado === 'proximos') return { ruta: '/vencimientos/proximos', query: paginado };
  return {
    ruta: '/vencimientos',
    query: {
      ...paginado,
      estado: filtros.estado === 'todos' ? undefined : filtros.estado,
      clienteId: filtros.cliente,
      impuestoId: filtros.impuesto,
      desde: filtros.desde,
      hasta: filtros.hasta,
    },
  };
}

/** URL del listado con esos filtros. Omite los defaults; en "Próximos", también cliente, impuesto y fechas. */
export function urlVencimientos(filtros: Partial<FiltrosVencimientos> = {}): string {
  const query = new URLSearchParams();
  const estado = filtros.estado ?? PESTANA_DEFAULT;
  if (estado !== PESTANA_DEFAULT) query.set('estado', estado);
  if (estado !== 'proximos') {
    for (const clave of ['cliente', 'impuesto', 'desde', 'hasta'] as const) {
      const valor = filtros[clave]?.trim();
      if (valor) query.set(clave, valor);
    }
  }
  if (filtros.pagina && filtros.pagina > 1) query.set('pagina', String(filtros.pagina));
  const qs = query.toString();
  return qs ? `/vencimientos?${qs}` : '/vencimientos';
}

type ConteosApi = Estadisticas['vencimientos'];

/**
 * Cantidad de cada pestaña, de `vencimientos` de `GET /estadisticas` ("Todos" =
 * la suma de los tres estados). Son totales del estudio: con otros filtros no
 * coincidirían con lo listado, así que van sin número (`undefined`).
 */
export function conteosPestanas(
  conteos: ConteosApi | undefined,
  filtros: FiltrosVencimientos,
): Record<Pestana, number> | undefined {
  if (!conteos || hayFiltros(filtros)) return undefined;
  return {
    vencido: conteos.vencidos,
    pendiente: conteos.pendientes,
    proximos: conteos.proximos30Dias,
    presentado: conteos.presentados,
    todos: conteos.pendientes + conteos.vencidos + conteos.presentados,
  };
}

/** Con los cuatro conteos en 0, el estudio no tiene vencimientos (no hace falta otra llamada). */
export function estudioSinVencimientos(conteos: ConteosApi | undefined): boolean {
  return Boolean(conteos) && Object.values(conteos!).every((n) => n === 0);
}

// ---------------------------------------------------------------------------
// Avisos del detalle y del listado (`?ok=`)

export const AVISOS_VENCIMIENTO = {
  creado: 'Vencimiento creado',
  presentado: 'Marcado como presentado',
  pendiente: 'Volvió a pendiente',
  notas: 'Notas guardadas',
  borrado: 'Vencimiento borrado',
} as const;
export type AvisoVencimiento = keyof typeof AVISOS_VENCIMIENTO;

/** Texto del aviso `?ok=`, o `undefined` si falta o no es conocido. */
export function leerAvisoVencimiento(params: Params): string | undefined {
  const ok = leer(params, 'ok');
  return ok && Object.hasOwn(AVISOS_VENCIMIENTO, ok)
    ? AVISOS_VENCIMIENTO[ok as AvisoVencimiento]
    : undefined;
}

// ---------------------------------------------------------------------------
// Formularios: validación (lo genérico está en `formularios.ts`)

export const CAMPOS_VENCIMIENTO = ['clienteId', 'impuestoId', 'fechaVencimiento', 'periodo', 'notas'] as const;
export type CampoVencimiento = (typeof CAMPOS_VENCIMIENTO)[number];
export type DatosVencimiento = Record<CampoVencimiento, string>;

export const NOTAS_MAX = 2000;

export const MENSAJES_VENCIMIENTO = {
  cliente: 'Elegí un cliente',
  impuesto: 'Elegí un impuesto',
  fecha: 'Ingresá una fecha válida',
  periodo: 'Ingresá el período',
  notas: `Las notas pueden tener hasta ${NOTAS_MAX} caracteres`,
  presentacionFutura: 'La fecha de presentación no puede ser futura',
} as const;

/** Formato del período según la periodicidad (mismas regex que la API). */
export const FORMATO_PERIODO: Record<Periodicidad, { regex: RegExp; texto: string; ejemplo: string }> = {
  mensual: { regex: /^\d{4}-(0[1-9]|1[0-2])$/, texto: 'AAAA-MM', ejemplo: '2026-10' },
  anual: { regex: /^\d{4}$/, texto: 'AAAA', ejemplo: '2025' },
};

/** Ayuda del campo Período: general (sin impuesto elegido, o sin JS) o la de esa periodicidad. */
export function ayudaPeriodo(periodicidad?: Periodicidad): string {
  if (!periodicidad) {
    return 'AAAA-MM para impuestos mensuales (por ejemplo, 2026-10), AAAA para anuales (por ejemplo, 2025)';
  }
  const { texto, ejemplo } = FORMATO_PERIODO[periodicidad];
  return `Formato ${texto}, por ejemplo ${ejemplo}`;
}

/**
 * Normaliza un `<textarea>`: el navegador manda los saltos de línea como `\r\n`
 * (dos caracteres) y la API los cuenta como uno solo al guardar. Así el largo
 * que se valida es el mismo que ve el usuario (`maxLength`).
 */
export function normalizarNotas(notas: string): string {
  return notas.replace(/\r\n?/g, '\n');
}

export function validarNotas(notas: string): string | undefined {
  return normalizarNotas(notas).trim().length > NOTAS_MAX ? MENSAJES_VENCIMIENTO.notas : undefined;
}

type ImpuestoValidable = Pick<Impuesto, 'id' | 'nombre' | 'periodicidad'>;

/** Errores por campo, en español. El período se valida contra la periodicidad del impuesto elegido. */
export function validarVencimiento(
  datos: DatosVencimiento,
  impuestos: readonly ImpuestoValidable[],
): Partial<Record<CampoVencimiento, string>> {
  const errores: Partial<Record<CampoVencimiento, string>> = {};
  if (!esUuid(datos.clienteId)) errores.clienteId = MENSAJES_VENCIMIENTO.cliente;
  const impuesto = impuestos.find((i) => i.id === datos.impuestoId);
  if (!impuesto) errores.impuestoId = MENSAJES_VENCIMIENTO.impuesto;
  if (!fechaValida(datos.fechaVencimiento.trim())) errores.fechaVencimiento = MENSAJES_VENCIMIENTO.fecha;

  const periodo = datos.periodo.trim();
  if (!periodo) errores.periodo = MENSAJES_VENCIMIENTO.periodo;
  else if (impuesto) {
    const { regex, texto, ejemplo } = FORMATO_PERIODO[impuesto.periodicidad];
    if (!regex.test(periodo)) {
      errores.periodo = `Para ${impuesto.nombre} el período es ${texto} (por ejemplo, ${ejemplo})`;
    }
  }

  const notas = validarNotas(datos.notas);
  if (notas) errores.notas = notas;
  return errores;
}

/** Body para `POST /vencimientos` (llamar después de `validarVencimiento`). Notas vacías → `null`. */
export function bodyVencimiento(datos: DatosVencimiento): CrearVencimientoBody {
  return {
    clienteId: datos.clienteId,
    impuestoId: datos.impuestoId,
    fechaVencimiento: datos.fechaVencimiento.trim(),
    periodo: datos.periodo.trim(),
    notas: normalizarNotas(datos.notas).trim() || null,
  };
}

/** Vacía es válida (la API usa la fecha de hoy). `hoy` = `hoyArgentina()`. */
export function validarPresentacion(fecha: string, hoy: string): string | undefined {
  const f = fecha.trim();
  if (!f) return undefined;
  if (!fechaValida(f)) return MENSAJES_VENCIMIENTO.fecha;
  if (f > hoy) return MENSAJES_VENCIMIENTO.presentacionFutura;
  return undefined;
}
