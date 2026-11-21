// Helpers puros de CUIT. Sin `server-only`: los usan el formulario (cliente),
// las Server Actions, las páginas y los e2e (que generan CUIT válidos).

const PESOS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/** Quita guiones y espacios (la API acepta ambos y guarda solo los dígitos). */
export function normalizarCuit(cuit: string): string {
  return cuit.replace(/[-\s]/g, '');
}

/**
 * Dígito verificador (módulo 11) de los primeros 10 dígitos, o `null` si el
 * cálculo da 10 (AFIP nunca asigna esos CUIT). Misma regla que `IsCuit` de la API.
 */
export function digitoVerificador(primeros10: string): number | null {
  const suma = PESOS.reduce((acc, peso, i) => acc + peso * Number(primeros10[i]), 0);
  const resto = 11 - (suma % 11);
  if (resto === 11) return 0;
  if (resto === 10) return null;
  return resto;
}

/** 11 dígitos (después de normalizar) con el dígito verificador correcto. */
export function cuitValido(cuit: string): boolean {
  const limpio = normalizarCuit(cuit);
  if (!/^\d{11}$/.test(limpio)) return false;
  return digitoVerificador(limpio.slice(0, 10)) === Number(limpio[10]);
}

/** `30712345671` → `30-71234567-1`. Si no son 11 dígitos, lo devuelve como vino. */
export function formatearCuit(cuit: string): string {
  const limpio = normalizarCuit(cuit);
  if (!/^\d{11}$/.test(limpio)) return cuit;
  return `${limpio.slice(0, 2)}-${limpio.slice(2, 10)}-${limpio.slice(10)}`;
}
