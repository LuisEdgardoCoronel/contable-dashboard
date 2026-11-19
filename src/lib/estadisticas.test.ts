import { describe, expect, it } from 'vitest';

import { datosPorImpuesto, datosPorMes, hayVencimientos, leerRango } from './estadisticas';

describe('datosPorMes', () => {
  it('agrega las etiquetas corta y larga del mes', () => {
    expect(datosPorMes([{ mes: '2026-06', pendientes: 1, vencidos: 2, presentados: 3 }])).toEqual([
      {
        mes: '2026-06',
        etiqueta: 'jun 2026',
        etiquetaLarga: 'junio 2026',
        pendientes: 1,
        vencidos: 2,
        presentados: 3,
      },
    ]);
  });
});

describe('datosPorImpuesto', () => {
  it('aplana el impuesto y conserva el orden de la API', () => {
    const impuesto = (codigo: 'IVA' | 'IIBB', nombre: string) => ({ id: codigo, codigo, nombre });
    expect(
      datosPorImpuesto([
        { impuesto: impuesto('IIBB', 'Ingresos Brutos'), pendientes: 0, vencidos: 1, presentados: 0 },
        { impuesto: impuesto('IVA', 'IVA'), pendientes: 4, vencidos: 0, presentados: 2 },
      ]),
    ).toEqual([
      { codigo: 'IIBB', nombre: 'Ingresos Brutos', pendientes: 0, vencidos: 1, presentados: 0 },
      { codigo: 'IVA', nombre: 'IVA', pendientes: 4, vencidos: 0, presentados: 2 },
    ]);
  });
});

describe('hayVencimientos', () => {
  it('es false si no hay puntos o están todos en cero', () => {
    expect(hayVencimientos([])).toBe(false);
    expect(hayVencimientos([{ pendientes: 0, vencidos: 0, presentados: 0 }])).toBe(false);
  });

  it('es true si algún estado tiene algo', () => {
    expect(
      hayVencimientos([
        { pendientes: 0, vencidos: 0, presentados: 0 },
        { pendientes: 0, vencidos: 0, presentados: 1 },
      ]),
    ).toBe(true);
  });
});

describe('leerRango', () => {
  it('lee desde y hasta', () => {
    expect(leerRango({ desde: '2026-01-01', hasta: '2026-03-31' })).toEqual({
      desde: '2026-01-01',
      hasta: '2026-03-31',
    });
  });

  it('trata vacíos y ausentes como undefined', () => {
    expect(leerRango({ desde: '', hasta: '  ' })).toEqual({ desde: undefined, hasta: undefined });
    expect(leerRango({})).toEqual({ desde: undefined, hasta: undefined });
  });

  it('con valores repetidos toma el primero', () => {
    expect(leerRango({ desde: ['2026-01-01', '2026-02-01'] }).desde).toBe('2026-01-01');
  });
});
