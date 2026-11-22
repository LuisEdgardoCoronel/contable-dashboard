import { describe, expect, it } from 'vitest';

import { hayErrores, leerCampos } from './formularios';

describe('leerCampos', () => {
  it('devuelve strings, con "" para lo ausente', () => {
    const fd = new FormData();
    fd.set('razonSocial', 'X');
    expect(leerCampos(fd, ['razonSocial', 'cuit'])).toEqual({ razonSocial: 'X', cuit: '' });
  });
});

describe('hayErrores', () => {
  it('cuenta solo los mensajes no vacíos', () => {
    expect(hayErrores({})).toBe(false);
    expect(hayErrores({ cuit: undefined, email: '' })).toBe(false);
    expect(hayErrores({ cuit: 'El CUIT no es válido' })).toBe(true);
  });
});
