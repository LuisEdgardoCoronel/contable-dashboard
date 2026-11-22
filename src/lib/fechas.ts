// Las fechas de la API son strings `YYYY-MM-DD` (sin hora). NUNCA pasarlas por
// `new Date()`: se interpretan como medianoche UTC, que en Argentina es el día
// anterior. Se formatean manipulando el string.

const FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;
const MES = /^(\d{4})-(\d{2})$/;

const NOMBRES_MES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

function nombreMes(mm: string): string | undefined {
  return NOMBRES_MES[Number(mm) - 1];
}

/** `2026-11-05` → `05/11/2026`. Si el formato no es válido, devuelve el valor tal cual. */
export function formatearFecha(fecha: string | null | undefined): string {
  if (!fecha) return '';
  const m = FECHA.exec(fecha);
  if (!m || !nombreMes(m[2])) return fecha;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** `2026-11-05` → `5 de noviembre de 2026`. */
export function formatearFechaLarga(fecha: string | null | undefined): string {
  if (!fecha) return '';
  const m = FECHA.exec(fecha);
  const mes = m && nombreMes(m[2]);
  if (!m || !mes) return fecha;
  return `${Number(m[3])} de ${mes} de ${m[1]}`;
}

/** `2026-06` → `junio 2026` (para `porMes` de las estadísticas). */
export function formatearMes(mes: string | null | undefined): string {
  if (!mes) return '';
  const m = MES.exec(mes);
  const nombre = m && nombreMes(m[2]);
  if (!m || !nombre) return mes;
  return `${nombre} ${m[1]}`;
}

/** `2026-06` → `jun 2026` (eje de los gráficos). */
export function formatearMesCorto(mes: string | null | undefined): string {
  if (!mes) return '';
  const m = MES.exec(mes);
  const nombre = m && nombreMes(m[2]);
  if (!m || !nombre) return mes;
  return `${nombre.slice(0, 3)} ${m[1]}`;
}

const DIAS_POR_MES = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

/** `true` si es `YYYY-MM-DD` y el día existe (bisiestos incluidos). Misma regla que `IsFecha` de la API. */
export function fechaValida(fecha: string): boolean {
  const m = FECHA.exec(fecha);
  if (!m) return false;
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mes < 1 || mes > 12 || dia < 1) return false;
  const maximo = mes === 2 && esBisiesto(anio) ? 29 : DIAS_POR_MES[mes - 1];
  return dia <= maximo;
}

const FORMATO_HOY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Argentina/Buenos_Aires',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Hoy en Argentina como `YYYY-MM-DD` (igual que la API). No parsea fechas de la
 * API: toma el instante actual y lo formatea en la zona correcta; `en-CA` da el
 * formato ISO.
 */
export function hoyArgentina(): string {
  return FORMATO_HOY.format(Date.now());
}
