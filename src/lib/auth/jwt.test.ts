import { describe, expect, it } from 'vitest';

import { leerExpiracion, tokenVigente } from './jwt';

function jwt(payload: object): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.firma`;
}

describe('leerExpiracion', () => {
  it('lee el exp del payload sin verificar la firma', () => {
    expect(leerExpiracion(jwt({ sub: 'x', exp: 1795038542 }))).toBe(1795038542);
  });

  it('soporta payloads con caracteres base64url (- y _) y UTF-8', () => {
    expect(leerExpiracion(jwt({ nombre: 'Estudio Muñoz ??>>', exp: 42 }))).toBe(42);
  });

  it('devuelve null si no es un JWT o no tiene exp numérico', () => {
    expect(leerExpiracion('basura')).toBeNull();
    expect(leerExpiracion('a.b.c')).toBeNull();
    expect(leerExpiracion(jwt({ sub: 'x' }))).toBeNull();
    expect(leerExpiracion(jwt({ exp: '123' }))).toBeNull();
  });
});

describe('tokenVigente', () => {
  const ahora = 1_800_000_000;

  it('es vigente si exp es posterior a ahora', () => {
    expect(tokenVigente(jwt({ exp: ahora + 60 }), ahora)).toBe(true);
  });

  it('trata como ausente un token vencido, sin exp o vacío', () => {
    expect(tokenVigente(jwt({ exp: ahora - 1 }), ahora)).toBe(false);
    expect(tokenVigente(jwt({ exp: ahora }), ahora)).toBe(false);
    expect(tokenVigente(jwt({}), ahora)).toBe(false);
    expect(tokenVigente(undefined, ahora)).toBe(false);
    expect(tokenVigente('', ahora)).toBe(false);
  });
});
