import { describe, expect, it } from 'vitest';

import {
  bodyAcceso,
  bodyCliente,
  calcularPaginacion,
  esUuid,
  etiquetaCondicionIVA,
  hayFiltros,
  leerAviso,
  leerCampos,
  leerFiltrosClientes,
  MENSAJES,
  queryClientes,
  urlClientes,
  validarAcceso,
  validarCliente,
  type DatosCliente,
} from './clientes';

const clienteOk: DatosCliente = {
  razonSocial: 'Panadería La Espiga SRL',
  cuit: '30-71234567-1',
  email: 'admin@laespiga.com',
  telefono: '',
  condicionIVA: 'monotributista',
};

describe('validarCliente', () => {
  it('sin errores con datos válidos', () => {
    expect(validarCliente(clienteOk)).toEqual({});
  });

  it('acepta el CUIT con o sin guiones o espacios', () => {
    expect(validarCliente({ ...clienteOk, cuit: '30712345671' })).toEqual({});
    expect(validarCliente({ ...clienteOk, cuit: ' 30 71234567 1 ' })).toEqual({});
  });

  it('marca cada campo con su mensaje', () => {
    expect(
      validarCliente({
        razonSocial: '   ',
        cuit: '30712345670',
        email: 'no-es-email',
        telefono: '1'.repeat(51),
        condicionIVA: '',
      }),
    ).toEqual({
      razonSocial: 'Ingresá la razón social',
      cuit: 'El CUIT no es válido',
      email: 'Ingresá un email válido',
      telefono: 'El teléfono puede tener hasta 50 caracteres',
      condicionIVA: 'Elegí una condición frente al IVA',
    });
  });

  it('límites de largo', () => {
    expect(validarCliente({ ...clienteOk, telefono: '1'.repeat(50) })).toEqual({});
    expect(validarCliente({ ...clienteOk, razonSocial: 'a'.repeat(256) }).razonSocial).toBe(
      MENSAJES.razonSocialLarga,
    );
    expect(validarCliente({ ...clienteOk, email: `${'a'.repeat(250)}@x.com` }).email).toBe(
      MENSAJES.email,
    );
  });

  it('rechaza una condición IVA desconocida', () => {
    expect(validarCliente({ ...clienteOk, condicionIVA: 'otra' }).condicionIVA).toBe(
      MENSAJES.condicionIVA,
    );
  });
});

describe('bodyCliente', () => {
  it('recorta, normaliza el CUIT y manda null si el teléfono está vacío', () => {
    expect(bodyCliente({ ...clienteOk, razonSocial: '  La Espiga  ', telefono: '  ' })).toEqual({
      razonSocial: 'La Espiga',
      cuit: '30712345671',
      email: 'admin@laespiga.com',
      telefono: null,
      condicionIVA: 'monotributista',
    });
    expect(bodyCliente({ ...clienteOk, telefono: ' 1145678900 ' }).telefono).toBe('1145678900');
  });
});

describe('validarAcceso y bodyAcceso', () => {
  const ok = { email: 'duenio@laespiga.com', password: 'claveInicial', nombre: '' };

  it('sin errores con datos válidos', () => {
    expect(validarAcceso(ok)).toEqual({});
  });

  it('contraseña de 8 a 72 caracteres', () => {
    expect(validarAcceso({ ...ok, password: '1234567' }).password).toBe(MENSAJES.password);
    expect(validarAcceso({ ...ok, password: 'a'.repeat(73) }).password).toBe(MENSAJES.password);
    expect(validarAcceso({ ...ok, password: '12345678' })).toEqual({});
    expect(validarAcceso({ ...ok, password: 'a'.repeat(72) })).toEqual({});
  });

  it('email inválido y nombre largo', () => {
    expect(validarAcceso({ ...ok, email: '' }).email).toBe(MENSAJES.email);
    expect(validarAcceso({ ...ok, nombre: 'a'.repeat(256) }).nombre).toBe(MENSAJES.nombreLargo);
  });

  it('omite el nombre vacío y no recorta la contraseña', () => {
    expect(bodyAcceso({ ...ok, password: ' con espacios ' })).toEqual({
      email: 'duenio@laespiga.com',
      password: ' con espacios ',
    });
    expect(bodyAcceso({ ...ok, nombre: ' María ' }).nombre).toBe('María');
  });
});

describe('leerCampos', () => {
  it('devuelve strings, con "" para lo ausente', () => {
    const fd = new FormData();
    fd.set('razonSocial', 'X');
    expect(leerCampos(fd, ['razonSocial', 'cuit'])).toEqual({ razonSocial: 'X', cuit: '' });
  });
});

describe('leerFiltrosClientes', () => {
  it('valores por defecto', () => {
    expect(leerFiltrosClientes({})).toEqual({ buscar: undefined, estado: 'activos', pagina: 1 });
  });

  it('lee los valores válidos', () => {
    expect(leerFiltrosClientes({ buscar: ' espiga ', estado: 'baja', pagina: '3' })).toEqual({
      buscar: 'espiga',
      estado: 'baja',
      pagina: 3,
    });
    expect(leerFiltrosClientes({ estado: 'todos' }).estado).toBe('todos');
  });

  it.each(['0', '-1', '1.5', 'abc', '', '99999999999999999999'])('pagina=%j → 1', (pagina) => {
    expect(leerFiltrosClientes({ pagina }).pagina).toBe(1);
  });

  it('estado inválido → activos; buscar vacío → undefined', () => {
    expect(leerFiltrosClientes({ estado: 'ACTIVOS', buscar: '   ' })).toEqual({
      buscar: undefined,
      estado: 'activos',
      pagina: 1,
    });
  });

  it('un parámetro repetido toma el primero', () => {
    expect(
      leerFiltrosClientes({ buscar: ['a', 'b'], estado: ['baja', 'todos'], pagina: ['2', '5'] }),
    ).toEqual({ buscar: 'a', estado: 'baja', pagina: 2 });
  });

  it('recorta buscar a 100 caracteres (el máximo de la API)', () => {
    expect(leerFiltrosClientes({ buscar: 'x'.repeat(150) }).buscar).toHaveLength(100);
  });
});

describe('queryClientes', () => {
  it('traduce los filtros a la API', () => {
    expect(queryClientes({ buscar: 'x', estado: 'activos', pagina: 2 })).toEqual({
      search: 'x',
      activo: true,
      page: 2,
      limit: 20,
    });
    expect(queryClientes({ estado: 'baja', pagina: 1 }).activo).toBe(false);
    expect(queryClientes({ estado: 'todos', pagina: 1 }).activo).toBeUndefined();
  });
});

describe('hayFiltros', () => {
  it('solo cuenta buscar y un estado distinto del default', () => {
    expect(hayFiltros({ estado: 'activos', pagina: 4 })).toBe(false);
    expect(hayFiltros({ estado: 'todos', pagina: 1 })).toBe(true);
    expect(hayFiltros({ buscar: 'a', estado: 'activos', pagina: 1 })).toBe(true);
  });
});

describe('urlClientes', () => {
  it('omite los valores por defecto', () => {
    expect(urlClientes({})).toBe('/clientes');
    expect(urlClientes({ buscar: '  ', estado: 'activos', pagina: 1 })).toBe('/clientes');
  });

  it('conserva los filtros y codifica el texto', () => {
    expect(urlClientes({ buscar: 'La Espiga & Cía', estado: 'baja', pagina: 2 })).toBe(
      '/clientes?buscar=La+Espiga+%26+C%C3%ADa&estado=baja&pagina=2',
    );
    expect(urlClientes({ buscar: 'x', estado: 'activos', pagina: 3 })).toBe(
      '/clientes?buscar=x&pagina=3',
    );
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

describe('esUuid, leerAviso y etiquetaCondicionIVA', () => {
  it('esUuid', () => {
    expect(esUuid('3f2b8c1e-9a4d-4e2f-8b1a-0c9d8e7f6a5b')).toBe(true);
    expect(esUuid('no-es-uuid')).toBe(false);
    expect(esUuid('3f2b8c1e9a4d4e2f8b1a0c9d8e7f6a5b')).toBe(false);
  });

  it('leerAviso', () => {
    expect(leerAviso({ ok: 'creado' })).toBe('Cliente creado');
    expect(leerAviso({ ok: 'baja' })).toBe('Cliente dado de baja');
    expect(leerAviso({ ok: 'toString' })).toBeUndefined();
    expect(leerAviso({})).toBeUndefined();
  });

  it('etiquetaCondicionIVA', () => {
    expect(etiquetaCondicionIVA('responsable_inscripto')).toBe('Responsable inscripto');
    expect(etiquetaCondicionIVA('desconocida')).toBe('desconocida');
  });
});
