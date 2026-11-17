import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatearFecha, formatearFechaLarga, formatearMes } from './fechas';

describe('formatearFecha', () => {
  it('formatea YYYY-MM-DD como DD/MM/AAAA', () => {
    expect(formatearFecha('2026-11-05')).toBe('05/11/2026');
    expect(formatearFecha('2026-01-31')).toBe('31/01/2026');
  });

  it('no corre el día por la zona horaria (medianoche UTC = día anterior en Argentina)', () => {
    vi.stubEnv('TZ', 'America/Argentina/Buenos_Aires');
    expect(formatearFecha('2026-01-01')).toBe('01/01/2026');
    expect(formatearFechaLarga('2026-01-01')).toBe('1 de enero de 2026');
  });

  it('devuelve vacío para null, undefined o vacío', () => {
    expect(formatearFecha(null)).toBe('');
    expect(formatearFecha(undefined)).toBe('');
    expect(formatearFecha('')).toBe('');
  });

  it('devuelve el valor tal cual si el formato no es válido', () => {
    expect(formatearFecha('05/11/2026')).toBe('05/11/2026');
    expect(formatearFecha('2026-13-01')).toBe('2026-13-01');
    expect(formatearFecha('2026-11-05T00:00:00Z')).toBe('2026-11-05T00:00:00Z');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });
});

describe('formatearFechaLarga', () => {
  it('usa el nombre del mes en español y el día sin cero', () => {
    expect(formatearFechaLarga('2026-11-05')).toBe('5 de noviembre de 2026');
    expect(formatearFechaLarga('2026-12-31')).toBe('31 de diciembre de 2026');
  });
});

describe('formatearMes', () => {
  it('formatea YYYY-MM como "mes año"', () => {
    expect(formatearMes('2026-06')).toBe('junio 2026');
    expect(formatearMes('2025-12')).toBe('diciembre 2025');
  });

  it('devuelve el valor tal cual si no es YYYY-MM', () => {
    expect(formatearMes('2026')).toBe('2026');
    expect(formatearMes('2026-00')).toBe('2026-00');
  });
});
