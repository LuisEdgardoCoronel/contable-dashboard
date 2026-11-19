// Helpers puros para la pantalla de Inicio. Sin `server-only`: los usan la
// página (servidor) y los gráficos (cliente). Los tipos se importan con
// `import type`, así no se arrastra `types.ts` al bundle del cliente.
import type { ConteoImpuesto, ConteoMes } from '@/lib/api/types';

import { formatearMes, formatearMesCorto } from './fechas';

/** Las tres series de los gráficos, en el orden en que se apilan. */
export const ESTADOS = ['pendientes', 'vencidos', 'presentados'] as const;
export type Estado = (typeof ESTADOS)[number];

/** Texto y color de cada estado. Lo comparten tarjetas, leyendas y tooltips. */
export const ESTADO_INFO: Record<Estado, { etiqueta: string; color: string }> = {
  pendientes: { etiqueta: 'Pendientes (al día)', color: 'var(--estado-pendiente)' },
  vencidos: { etiqueta: 'Vencidos', color: 'var(--estado-vencido)' },
  presentados: { etiqueta: 'Presentados', color: 'var(--estado-presentado)' },
};

type Conteos = Record<Estado, number>;

export interface PuntoMes extends Conteos {
  mes: string;
  /** `jun 2026`, para el eje. */
  etiqueta: string;
  /** `junio 2026`, para el tooltip. */
  etiquetaLarga: string;
}

export interface PuntoImpuesto extends Conteos {
  codigo: string;
  nombre: string;
}

export function datosPorMes(porMes: ConteoMes[]): PuntoMes[] {
  return porMes.map(({ mes, pendientes, vencidos, presentados }) => ({
    mes,
    etiqueta: formatearMesCorto(mes),
    etiquetaLarga: formatearMes(mes),
    pendientes,
    vencidos,
    presentados,
  }));
}

export function datosPorImpuesto(porImpuesto: ConteoImpuesto[]): PuntoImpuesto[] {
  return porImpuesto.map(({ impuesto, pendientes, vencidos, presentados }) => ({
    codigo: impuesto.codigo,
    nombre: impuesto.nombre,
    pendientes,
    vencidos,
    presentados,
  }));
}

/** `true` si algún punto tiene al menos un vencimiento (si no, el gráfico se reemplaza por un aviso). */
export function hayVencimientos(puntos: Conteos[]): boolean {
  return puntos.some((p) => ESTADOS.some((e) => p[e] > 0));
}

export interface RangoPedido {
  desde?: string;
  hasta?: string;
}

/**
 * Lee `desde`/`hasta` de los `searchParams`. Un valor repetido toma el primero
 * y un string vacío cuenta como ausente. No valida el formato: eso lo hace la
 * API, que responde 400 con su mensaje.
 */
export function leerRango(params: Record<string, string | string[] | undefined>): RangoPedido {
  const leer = (clave: string) => {
    const v = params[clave];
    const valor = (Array.isArray(v) ? v[0] : v)?.trim();
    return valor ? valor : undefined;
  };
  return { desde: leer('desde'), hasta: leer('hasta') };
}
