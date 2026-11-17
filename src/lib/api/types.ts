import 'server-only';

import type { components, paths } from './schema';

// Alias legibles derivados del schema generado (`npm run types`).
// Nunca editar schema.d.ts a mano: si la API cambia, se regenera.
// Los componentes cliente pueden usarlos con `import type` (no arrastra código).

type Schemas = components['schemas'];

export type Perfil = Schemas['PerfilResponseDto'];
export type Rol = Perfil['rol'];
export type LoginRespuesta = Schemas['LoginResponseDto'];

export type Cliente = Schemas['ClienteResponseDto'];
export type CondicionIVA = Cliente['condicionIVA'];
export type CrearClienteBody = Schemas['CrearClienteDto'];
export type ActualizarClienteBody = Schemas['ActualizarClienteDto'];
export type CrearAccesoBody = Schemas['CrearAccesoDto'];
export type Usuario = Schemas['UsuarioResponseDto'];

export type Impuesto = Schemas['ImpuestoResponseDto'];

export type Vencimiento = Schemas['VencimientoResponseDto'];
export type EstadoVencimiento = Vencimiento['estadoActual'];
export type CrearVencimientoBody = Schemas['CrearVencimientoDto'];
export type ActualizarVencimientoBody = Schemas['ActualizarVencimientoDto'];

export type Estadisticas = Schemas['EstadisticasResponseDto'];
export type ConteoMes = Schemas['ConteoMesDto'];
export type ConteoImpuesto = Schemas['ConteoImpuestoDto'];

export interface Paginado<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

type QueryDe<P extends keyof paths> = paths[P] extends {
  get: { parameters: { query?: infer Q } };
}
  ? NonNullable<Q>
  : never;

export type ClientesQuery = QueryDe<'/clientes'>;
export type VencimientosQuery = QueryDe<'/vencimientos'>;
export type EstadisticasQuery = QueryDe<'/estadisticas'>;

// Chequeo en compilación: si la forma paginada de la API cambia, esto deja de compilar.
type Asegurar<T extends true> = T;
export type _PaginadoCoincide = Asegurar<
  Schemas['ClientesPaginadosDto'] extends Paginado<Cliente>
    ? Schemas['VencimientosPaginadosDto'] extends Paginado<Vencimiento>
      ? true
      : false
    : false
>;
