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
