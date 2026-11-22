import { describe, expect, it } from 'vitest';

import { calcularPaginacion, esUuid, leerPagina, leerParametro } from './paginacion';

describe('leerParametro', () => {
  it('recorta, toma el primero si está repetido y trata lo vacío como ausente', () => {
    expect(leerParametro({ buscar: ' espiga ' }, 'buscar')).toBe('espiga');
    expect(leerParametro({ buscar: ['a', 'b'] }, 'buscar')).toBe('a');
    expect(leerParametro({ buscar: '   ' }, 'buscar')).toBeUndefined();
    expect(leerParametro({}, 'buscar')).toBeUndefined();
  });
});

describe('leerPagina', () => {
  it('lee un entero ≥ 1; repetido → el primero', () => {
    expect(leerPagina({})).toBe(1);
    expect(leerPagina({ pagina: '3' })).toBe(3);
    expect(leerPagina({ pagina: ['2', '5'] })).toBe(2);
  });

  it.each(['0', '-1', '1.5', 'abc', '', '99999999999999999999'])('pagina=%j → 1', (pagina) => {
    expect(leerPagina({ pagina })).toBe(1);
  });
});

describe('calcularPaginacion', () => {
  it('sin resultados hay una sola página', () => {
    expect(calcularPaginacion(0, 1)).toEqual({
      totalPaginas: 1,
      hayAnterior: false,
      haySiguiente: false,
    });
  });

  it('primera, del medio y última', () => {
    expect(calcularPaginacion(41, 1)).toEqual({ totalPaginas: 3, hayAnterior: false, haySiguiente: true });
    expect(calcularPaginacion(41, 2)).toEqual({ totalPaginas: 3, hayAnterior: true, haySiguiente: true });
    expect(calcularPaginacion(41, 3)).toEqual({ totalPaginas: 3, hayAnterior: true, haySiguiente: false });
  });

  it('justo en el límite y fuera de rango', () => {
    expect(calcularPaginacion(20, 1).totalPaginas).toBe(1);
    expect(calcularPaginacion(21, 1).totalPaginas).toBe(2);
    expect(calcularPaginacion(21, 9)).toEqual({ totalPaginas: 2, hayAnterior: true, haySiguiente: false });
  });
});

describe('esUuid', () => {
  it('acepta solo UUIDs con guiones', () => {
    expect(esUuid('3f2b8c1e-9a4d-4e2f-8b1a-0c9d8e7f6a5b')).toBe(true);
    expect(esUuid('no-es-uuid')).toBe(false);
    expect(esUuid('3f2b8c1e9a4d4e2f8b1a0c9d8e7f6a5b')).toBe(false);
  });
});
