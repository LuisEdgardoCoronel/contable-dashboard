import { describe, expect, it } from 'vitest';

import { cuitValido, digitoVerificador, formatearCuit, normalizarCuit } from './cuit';

describe('cuitValido', () => {
  it.each(['20123456786', '30712345671', '27123456780', '20-12345678-6', '30 71234567 1'])(
    'acepta %s',
    (cuit) => expect(cuitValido(cuit)).toBe(true),
  );

  it('acepta un CUIT cuyo verificador es 0 (resto 11)', () => {
    // 27-12345678-0: suma = 176, 176 % 11 = 0 → 11 - 0 = 11 → dígito 0.
    expect(digitoVerificador('2712345678')).toBe(0);
    expect(cuitValido('27123456780')).toBe(true);
  });

  it('rechaza los CUIT cuyo verificador calculado da 10', () => {
    expect(digitoVerificador('2000000001')).toBeNull();
    for (let d = 0; d <= 9; d++) expect(cuitValido(`2000000001${d}`)).toBe(false);
  });

  it.each([
    ['dígito verificador incorrecto', '20123456785'],
    ['menos de 11 dígitos', '2012345678'],
    ['más de 11 dígitos', '201234567861'],
    ['con letras', '2012345678A'],
    ['vacío', ''],
    ['otros separadores', '20.12345678.6'],
  ])('rechaza %s', (_caso, cuit) => expect(cuitValido(cuit)).toBe(false));
});

describe('normalizarCuit', () => {
  it('quita guiones y espacios', () => {
    expect(normalizarCuit(' 30-71234567-1 ')).toBe('30712345671');
    expect(normalizarCuit('30 71234567 1')).toBe('30712345671');
  });
});

describe('formatearCuit', () => {
  it('arma XX-XXXXXXXX-X', () => {
    expect(formatearCuit('30712345671')).toBe('30-71234567-1');
    expect(formatearCuit('30-71234567-1')).toBe('30-71234567-1');
  });

  it('deja como está lo que no son 11 dígitos', () => {
    expect(formatearCuit('123')).toBe('123');
  });
});
