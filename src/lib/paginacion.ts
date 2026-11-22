// Helpers puros para los listados paginados (los filtros y la página viven en la
// URL). Sin `server-only`: los usan las páginas (servidor) y los formularios
// (cliente).

export type Params = Record<string, string | string[] | undefined>;

/** Resultados por página de los listados del panel. */
export const POR_PAGINA = 20;

/** Primer valor de un parámetro (repetido → el primero), recortado; vacío → `undefined`. */
export function leerParametro(params: Params, clave: string): string | undefined {
  const v = params[clave];
  const valor = (Array.isArray(v) ? v[0] : v)?.trim();
  return valor ? valor : undefined;
}

/** `pagina` de los `searchParams`: un entero ≥ 1; cualquier otra cosa → 1. */
export function leerPagina(params: Params): number {
  const pedida = leerParametro(params, 'pagina');
  const numero = pedida && /^\d+$/.test(pedida) ? Number(pedida) : NaN;
  return Number.isSafeInteger(numero) && numero >= 1 ? numero : 1;
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** La API responde 400 a un `:id` que no es UUID: se chequea antes y se trata como no encontrado. */
export function esUuid(valor: string): boolean {
  return UUID.test(valor);
}
