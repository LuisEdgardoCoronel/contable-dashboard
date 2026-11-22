import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  fechaValida,
  formatearFecha,
  formatearFechaLarga,
  formatearMes,
  formatearMesCorto,
  hoyArgentina,
} from './fechas';

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

describe('formatearMesCorto', () => {
  it('abrevia el mes a tres letras', () => {
    expect(formatearMesCorto('2026-06')).toBe('jun 2026');
    expect(formatearMesCorto('2025-09')).toBe('sep 2025');
  });

  it('devuelve el valor tal cual si no es YYYY-MM', () => {
    expect(formatearMesCorto('2026-13')).toBe('2026-13');
    expect(formatearMesCorto('')).toBe('');
  });
});

describe('fechaValida', () => {
  it('acepta YYYY-MM-DD con un día que existe', () => {
    expect(fechaValida('2026-11-05')).toBe(true);
    expect(fechaValida('2026-12-31')).toBe(true);
    expect(fechaValida('2026-04-30')).toBe(true);
  });

  it('rechaza otros formatos', () => {
    expect(fechaValida('05/11/2026')).toBe(false);
    expect(fechaValida('2026-1-05')).toBe(false);
    expect(fechaValida('2026-11-05T00:00:00Z')).toBe(false);
    expect(fechaValida('')).toBe(false);
  });

  it('rechaza días y meses que no existen', () => {
    expect(fechaValida('2026-04-31')).toBe(false);
    expect(fechaValida('2026-13-01')).toBe(false);
    expect(fechaValida('2026-00-10')).toBe(false);
    expect(fechaValida('2026-11-00')).toBe(false);
  });

  it('29 de febrero solo en años bisiestos', () => {
    expect(fechaValida('2028-02-29')).toBe(true);
    expect(fechaValida('2000-02-29')).toBe(true);
    expect(fechaValida('2026-02-29')).toBe(false);
    expect(fechaValida('1900-02-29')).toBe(false);
  });
});

describe('hoyArgentina', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('usa la zona de Argentina, no UTC: las 2 UTC del 21 son el 20 en Argentina', () => {
    vi.setSystemTime(new Date('2026-11-21T02:00:00Z'));
    expect(hoyArgentina()).toBe('2026-11-20');
  });

  it('a las 3 UTC ya es el día siguiente en Argentina', () => {
    vi.setSystemTime(new Date('2026-11-21T03:00:00Z'));
    expect(hoyArgentina()).toBe('2026-11-21');
  });
});
