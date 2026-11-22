import { describe, expect, it } from 'vitest';

import {
  ayudaPeriodo,
  bodyVencimiento,
  consultaVencimientos,
  conteosPestanas,
  estudioSinVencimientos,
  formatearPeriodo,
  hayFiltros,
  leerAvisoVencimiento,
  leerFiltrosVencimientos,
  MENSAJES_VENCIMIENTO,
  urlVencimientos,
  validarNotas,
  validarPresentacion,
  validarVencimiento,
  type DatosVencimiento,
  type FiltrosVencimientos,
} from './vencimientos';

const UUID_CLIENTE = '3f2b8c1e-9a4d-4e2f-8b1a-0c9d8e7f6a5b';
const UUID_IMPUESTO = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
const IVA = { id: UUID_IMPUESTO, nombre: 'IVA', periodicidad: 'mensual' as const };
const GANANCIAS = { id: '11111111-2222-4333-8444-555555555555', nombre: 'Ganancias', periodicidad: 'anual' as const };
const IMPUESTOS = [GANANCIAS, IVA];

const base: FiltrosVencimientos = { estado: 'pendiente', pagina: 1 };

describe('leerFiltrosVencimientos', () => {
  it('por defecto: pestaña Pendientes, página 1, sin filtros', () => {
    expect(leerFiltrosVencimientos({})).toEqual({
      filtros: {
        estado: 'pendiente',
        cliente: undefined,
        impuesto: undefined,
        desde: undefined,
        hasta: undefined,
        pagina: 1,
      },
      errorFechas: undefined,
    });
  });

  it('lee los valores válidos', () => {
    expect(
      leerFiltrosVencimientos({
        estado: 'vencido',
        cliente: UUID_CLIENTE,
        impuesto: UUID_IMPUESTO,
        desde: '2026-01-01',
        hasta: '2026-12-31',
        pagina: '2',
      }),
    ).toEqual({
      filtros: {
        estado: 'vencido',
        cliente: UUID_CLIENTE,
        impuesto: UUID_IMPUESTO,
        desde: '2026-01-01',
        hasta: '2026-12-31',
        pagina: 2,
      },
      errorFechas: undefined,
    });
  });

  it('estado o página inválidos → defaults; un cliente/impuesto que no es UUID se ignora', () => {
    const { filtros } = leerFiltrosVencimientos({
      estado: 'VENCIDO',
      pagina: '0',
      cliente: 'no-es-uuid',
      impuesto: '123',
    });
    expect(filtros).toMatchObject({ estado: 'pendiente', pagina: 1, cliente: undefined, impuesto: undefined });
  });

  it('un parámetro repetido toma el primero', () => {
    const { filtros } = leerFiltrosVencimientos({ estado: ['presentado', 'todos'], pagina: ['3', '1'] });
    expect(filtros).toMatchObject({ estado: 'presentado', pagina: 3 });
  });

  it('en "proximos" ignora cliente, impuesto y fechas (también si son inválidas)', () => {
    expect(
      leerFiltrosVencimientos({ estado: 'proximos', cliente: UUID_CLIENTE, desde: 'mal', pagina: '2' }),
    ).toEqual({ filtros: { estado: 'proximos', pagina: 2 } });
  });

  it('fechas inválidas: conserva lo pedido y devuelve el error', () => {
    const { filtros, errorFechas } = leerFiltrosVencimientos({ desde: '2026-02-30' });
    expect(filtros.desde).toBe('2026-02-30');
    expect(errorFechas).toBe('Revisá las fechas: "Desde" no es una fecha válida');
    expect(leerFiltrosVencimientos({ hasta: '31/12/2026' }).errorFechas).toBe(
      'Revisá las fechas: "Hasta" no es una fecha válida',
    );
  });

  it('desde > hasta es un error; desde = hasta no', () => {
    expect(leerFiltrosVencimientos({ desde: '2026-12-01', hasta: '2026-11-30' }).errorFechas).toBe(
      'Revisá las fechas: "Desde" no puede ser posterior a "Hasta"',
    );
    expect(leerFiltrosVencimientos({ desde: '2026-12-01', hasta: '2026-12-01' }).errorFechas).toBeUndefined();
  });
});

describe('consultaVencimientos', () => {
  it('traduce los filtros a GET /vencimientos', () => {
    expect(
      consultaVencimientos({ ...base, cliente: UUID_CLIENTE, desde: '2026-01-01', pagina: 2 }),
    ).toEqual({
      ruta: '/vencimientos',
      query: {
        page: 2,
        limit: 20,
        estado: 'pendiente',
        clienteId: UUID_CLIENTE,
        impuestoId: undefined,
        desde: '2026-01-01',
        hasta: undefined,
      },
    });
  });

  it('"todos" no manda estado', () => {
    expect(consultaVencimientos({ estado: 'todos', pagina: 1 }).query.estado).toBeUndefined();
  });

  it('"proximos" va a /vencimientos/proximos solo con page y limit', () => {
    expect(consultaVencimientos({ estado: 'proximos', cliente: UUID_CLIENTE, pagina: 3 })).toEqual({
      ruta: '/vencimientos/proximos',
      query: { page: 3, limit: 20 },
    });
  });
});

describe('urlVencimientos', () => {
  it('omite los defaults', () => {
    expect(urlVencimientos()).toBe('/vencimientos');
    expect(urlVencimientos({ estado: 'pendiente', pagina: 1, cliente: '  ' })).toBe('/vencimientos');
  });

  it('conserva los filtros', () => {
    expect(
      urlVencimientos({
        estado: 'vencido',
        cliente: UUID_CLIENTE,
        impuesto: UUID_IMPUESTO,
        desde: '2026-01-01',
        hasta: '2026-02-01',
        pagina: 2,
      }),
    ).toBe(
      `/vencimientos?estado=vencido&cliente=${UUID_CLIENTE}&impuesto=${UUID_IMPUESTO}&desde=2026-01-01&hasta=2026-02-01&pagina=2`,
    );
  });

  it('"proximos" no conserva cliente, impuesto ni fechas', () => {
    expect(urlVencimientos({ estado: 'proximos', cliente: UUID_CLIENTE, desde: '2026-01-01', pagina: 2 })).toBe(
      '/vencimientos?estado=proximos&pagina=2',
    );
  });
});

describe('hayFiltros, conteosPestanas y estudioSinVencimientos', () => {
  const conteos = { pendientes: 8, vencidos: 3, presentados: 40, proximos30Dias: 5 };

  it('hayFiltros no cuenta la pestaña ni la página', () => {
    expect(hayFiltros({ estado: 'todos', pagina: 4 })).toBe(false);
    expect(hayFiltros({ ...base, impuesto: UUID_IMPUESTO })).toBe(true);
    expect(hayFiltros({ ...base, hasta: '2026-01-01' })).toBe(true);
  });

  it('cantidades de cada pestaña; "Todos" es la suma de los tres estados', () => {
    expect(conteosPestanas(conteos, base)).toEqual({
      vencido: 3,
      pendiente: 8,
      proximos: 5,
      presentado: 40,
      todos: 51,
    });
  });

  it('sin número con otros filtros o si /estadisticas falló', () => {
    expect(conteosPestanas(conteos, { ...base, cliente: UUID_CLIENTE })).toBeUndefined();
    expect(conteosPestanas(undefined, base)).toBeUndefined();
  });

  it('estudio sin vencimientos solo con los cuatro conteos en 0', () => {
    expect(estudioSinVencimientos({ pendientes: 0, vencidos: 0, presentados: 0, proximos30Dias: 0 })).toBe(true);
    expect(estudioSinVencimientos({ ...conteos, pendientes: 0, vencidos: 0, proximos30Dias: 0 })).toBe(false);
    expect(estudioSinVencimientos(undefined)).toBe(false);
  });
});

describe('formatearPeriodo y avisos', () => {
  it('formatearPeriodo', () => {
    expect(formatearPeriodo('2026-10')).toBe('octubre 2026');
    expect(formatearPeriodo('2025')).toBe('2025');
  });

  it('leerAvisoVencimiento', () => {
    expect(leerAvisoVencimiento({ ok: 'creado' })).toBe('Vencimiento creado');
    expect(leerAvisoVencimiento({ ok: 'borrado' })).toBe('Vencimiento borrado');
    expect(leerAvisoVencimiento({ ok: 'toString' })).toBeUndefined();
    expect(leerAvisoVencimiento({})).toBeUndefined();
  });

  it('ayudaPeriodo: general o según la periodicidad', () => {
    expect(ayudaPeriodo()).toBe(
      'AAAA-MM para impuestos mensuales (por ejemplo, 2026-10), AAAA para anuales (por ejemplo, 2025)',
    );
    expect(ayudaPeriodo('mensual')).toBe('Formato AAAA-MM, por ejemplo 2026-10');
    expect(ayudaPeriodo('anual')).toBe('Formato AAAA, por ejemplo 2025');
  });
});

describe('validarVencimiento y bodyVencimiento', () => {
  const ok: DatosVencimiento = {
    clienteId: UUID_CLIENTE,
    impuestoId: IVA.id,
    fechaVencimiento: '2026-11-18',
    periodo: '2026-10',
    notas: '',
  };

  it('sin errores con datos válidos (mensual y anual)', () => {
    expect(validarVencimiento(ok, IMPUESTOS)).toEqual({});
    expect(validarVencimiento({ ...ok, impuestoId: GANANCIAS.id, periodo: ' 2025 ' }, IMPUESTOS)).toEqual({});
  });

  it('marca cada campo con su mensaje', () => {
    expect(
      validarVencimiento(
        { clienteId: '', impuestoId: 'otro', fechaVencimiento: '2026-02-30', periodo: '  ', notas: 'a'.repeat(2001) },
        IMPUESTOS,
      ),
    ).toEqual({
      clienteId: 'Elegí un cliente',
      impuestoId: 'Elegí un impuesto',
      fechaVencimiento: 'Ingresá una fecha válida',
      periodo: 'Ingresá el período',
      notas: 'Las notas pueden tener hasta 2000 caracteres',
    });
  });

  it('el período tiene que coincidir con la periodicidad del impuesto', () => {
    expect(validarVencimiento({ ...ok, impuestoId: GANANCIAS.id, periodo: '2026-10' }, IMPUESTOS).periodo).toBe(
      'Para Ganancias el período es AAAA (por ejemplo, 2025)',
    );
    expect(validarVencimiento({ ...ok, periodo: '2026' }, IMPUESTOS).periodo).toBe(
      'Para IVA el período es AAAA-MM (por ejemplo, 2026-10)',
    );
    expect(validarVencimiento({ ...ok, periodo: '2026-13' }, IMPUESTOS).periodo).toBe(
      'Para IVA el período es AAAA-MM (por ejemplo, 2026-10)',
    );
  });

  it('sin impuesto válido no valida el formato del período (solo pide el impuesto)', () => {
    expect(validarVencimiento({ ...ok, impuestoId: '', periodo: 'x' }, IMPUESTOS)).toEqual({
      impuestoId: 'Elegí un impuesto',
    });
  });

  it('body: recorta y manda null si las notas están vacías', () => {
    expect(bodyVencimiento({ ...ok, periodo: ' 2026-10 ', notas: '   ' })).toEqual({
      clienteId: UUID_CLIENTE,
      impuestoId: IVA.id,
      fechaVencimiento: '2026-11-18',
      periodo: '2026-10',
      notas: null,
    });
    expect(bodyVencimiento({ ...ok, notas: ' línea 1\r\nlínea 2 ' }).notas).toBe('línea 1\nlínea 2');
  });
});

describe('validarNotas y validarPresentacion', () => {
  it('validarNotas: hasta 2000, contando los saltos de línea del textarea como uno', () => {
    expect(validarNotas('a'.repeat(2000))).toBeUndefined();
    expect(validarNotas('a'.repeat(2001))).toBe(MENSAJES_VENCIMIENTO.notas);
    // 1000 saltos \r\n + 1000 letras = 2000 caracteres para el usuario.
    expect(validarNotas('a\r\n'.repeat(1000))).toBeUndefined();
  });

  it('validarPresentacion: vacía vale; inválida o futura no', () => {
    const hoy = '2026-11-22';
    expect(validarPresentacion('', hoy)).toBeUndefined();
    expect(validarPresentacion('2026-11-22', hoy)).toBeUndefined();
    expect(validarPresentacion('2026-01-05', hoy)).toBeUndefined();
    expect(validarPresentacion('2026-02-30', hoy)).toBe('Ingresá una fecha válida');
    expect(validarPresentacion('2026-11-23', hoy)).toBe('La fecha de presentación no puede ser futura');
  });
});
