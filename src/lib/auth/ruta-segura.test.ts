import { describe, expect, it } from 'vitest';

import { rutaSegura } from './ruta-segura';

describe('rutaSegura', () => {
  it.each([
    ['/clientes', '/clientes'],
    ['/', '/'],
    ['/vencimientos?estado=vencido&page=2', '/vencimientos?estado=vencido&page=2'],
  ])('acepta la ruta interna %s', (entrada, esperado) => {
    expect(rutaSegura(entrada)).toBe(esperado);
  });

  it.each([
    ['//evil.com'],
    ['https://evil.com'],
    ['/\\evil.com'],
    ['\\\\evil.com'],
    ['evil.com'],
    ['javascript:alert(1)'],
    ['/\t/evil.com'],
    ['/\n/evil.com'],
  ])('rechaza %j y devuelve /', (entrada) => {
    expect(rutaSegura(entrada)).toBe('/');
  });

  it('devuelve / para vacío, undefined y null', () => {
    expect(rutaSegura('')).toBe('/');
    expect(rutaSegura(undefined)).toBe('/');
    expect(rutaSegura(null)).toBe('/');
  });
});
