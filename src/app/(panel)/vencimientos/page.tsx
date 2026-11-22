import Link from 'next/link';

import { Paginas } from '@/components/panel/paginas';
import { buttonVariants } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EstadoVencimiento } from '@/components/vencimientos/estado-vencimiento';
import { FiltrosVencimientos } from '@/components/vencimientos/filtros-vencimientos';
import { Pestanas } from '@/components/vencimientos/pestanas';
import { ApiError, apiFetch } from '@/lib/api/client';
import { todosLosClientes } from '@/lib/api/clientes';
import type { Cliente, Estadisticas, Impuesto, Paginado, Vencimiento } from '@/lib/api/types';
import { listarImpuestos } from '@/lib/api/vencimientos';
import { formatearFecha } from '@/lib/fechas';
import {
  consultaVencimientos,
  conteosPestanas,
  estudioSinVencimientos,
  formatearPeriodo,
  hayFiltros,
  leerAvisoVencimiento,
  leerFiltrosVencimientos,
  urlVencimientos,
  VACIO_PESTANA,
  type FiltrosVencimientos as Filtros,
} from '@/lib/vencimientos';

// Cache Components: cada página del panel lo declara (no se hereda del layout).
export const instant = false;

export const metadata = { title: 'Vencimientos' };

/** Los conteos de las pestañas son un extra: si `/estadisticas` falla, van sin número. */
async function conteos(): Promise<Estadisticas['vencimientos'] | undefined> {
  try {
    return (await apiFetch<Estadisticas>('/estadisticas')).vencimientos;
  } catch (e) {
    // El redirect() de un 401 no es ApiError: se relanza y Next lo maneja.
    if (e instanceof ApiError) return undefined;
    throw e;
  }
}

export default async function VencimientosPage({ searchParams }: PageProps<'/vencimientos'>) {
  const query = await searchParams;
  const { filtros, errorFechas } = leerFiltrosVencimientos(query);
  const aviso = leerAvisoVencimiento(query);
  const proximos = filtros.estado === 'proximos';
  const { ruta, query: queryApi } = consultaVencimientos(filtros);

  // Todo en paralelo. Con fechas inválidas no se pide el listado; en "Próximos"
  // no hay formulario de filtros, así que no hacen falta clientes ni impuestos.
  const [listado, totales, clientes, impuestos] = await Promise.all([
    errorFechas ? undefined : apiFetch<Paginado<Vencimiento>>(ruta, { query: { ...queryApi } }),
    conteos(),
    proximos ? ([] as Cliente[]) : todosLosClientes(),
    proximos ? ([] as Impuesto[]) : listarImpuestos(),
  ]);

  const url = urlVencimientos(filtros);
  const nuevoHref = filtros.cliente ? `/vencimientos/nuevo?cliente=${filtros.cliente}` : '/vencimientos/nuevo';

  return (
    <section className="flex min-w-0 flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Vencimientos</h1>
        <Link href={nuevoHref} className={buttonVariants()}>
          Nuevo vencimiento
        </Link>
      </div>

      {aviso && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-estado-presentado/50 bg-estado-presentado/10 px-4 py-3 text-sm"
        >
          <span className="font-medium">{aviso}</span>
          <Link href={url} className="text-muted-foreground hover:underline">
            Cerrar<span className="sr-only"> aviso</span>
          </Link>
        </div>
      )}

      <Pestanas filtros={filtros} conteos={conteosPestanas(totales, filtros)} />

      {proximos ? (
        <p className="text-sm text-muted-foreground">
          Próximos 30 días de clientes activos. Para filtrar por cliente, impuesto o fechas, usá otra
          pestaña.
        </p>
      ) : (
        <FiltrosVencimientos
          filtros={filtros}
          clientes={clientes.map(({ id, razonSocial, activo }) => ({ id, razonSocial, activo }))}
          impuestos={impuestos.map(({ id, nombre }) => ({ id, nombre }))}
        />
      )}

      {errorFechas || !listado ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm"
        >
          <p className="font-medium text-destructive">{errorFechas}</p>
          <Link href={urlVencimientos({ estado: filtros.estado })} className="hover:underline">
            Limpiar
          </Link>
        </div>
      ) : (
        <Resultados filtros={filtros} listado={listado} sinVencimientos={estudioSinVencimientos(totales)} />
      )}
    </section>
  );
}

function Resultados({
  filtros,
  listado: { data, total },
  sinVencimientos,
}: {
  filtros: Filtros;
  listado: Paginado<Vencimiento>;
  sinVencimientos: boolean;
}) {
  if (data.length === 0) {
    if (sinVencimientos) {
      return <Vacio texto="Todavía no cargaste vencimientos" href="/vencimientos/nuevo" link="Nuevo vencimiento" />;
    }
    if (filtros.pagina > 1 && total > 0) {
      return (
        <Vacio
          texto="No hay vencimientos en esta página"
          href={urlVencimientos({ ...filtros, pagina: 1 })}
          link="Ir a la página 1"
        />
      );
    }
    if (hayFiltros(filtros)) {
      return (
        <Vacio
          texto="No hay vencimientos con estos filtros"
          href={urlVencimientos({ estado: filtros.estado })}
          link="Limpiar filtros"
        />
      );
    }
    return <Vacio texto={VACIO_PESTANA[filtros.estado]} />;
  }

  return (
    <>
      <TablaVencimientos vencimientos={data} />
      <TarjetasVencimientos vencimientos={data} />
      <Paginas
        pagina={filtros.pagina}
        total={total}
        urlPagina={(pagina) => urlVencimientos({ ...filtros, pagina })}
        unidad={['vencimiento', 'vencimientos']}
      />
    </>
  );
}

function TablaVencimientos({ vencimientos }: { vencimientos: Vencimiento[] }) {
  return (
    <div className="hidden rounded-lg border md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vencimiento</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Impuesto</TableHead>
            <TableHead>Período</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Presentado el</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {vencimientos.map((v) => (
            <TableRow key={v.id}>
              <TableCell className="font-medium tabular-nums">
                <Link href={`/vencimientos/${v.id}`} className="hover:underline">
                  {formatearFecha(v.fechaVencimiento)}
                </Link>
              </TableCell>
              <TableCell className="max-w-64 truncate">{v.cliente.razonSocial}</TableCell>
              <TableCell>{v.impuesto.nombre}</TableCell>
              <TableCell>{formatearPeriodo(v.periodo)}</TableCell>
              <TableCell>
                <EstadoVencimiento estado={v.estadoActual} />
              </TableCell>
              <TableCell className="tabular-nums">{formatearFecha(v.fechaPresentacion) || '—'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** En el celular: una tarjeta por vencimiento, sin scroll horizontal. */
function TarjetasVencimientos({ vencimientos }: { vencimientos: Vencimiento[] }) {
  return (
    <ul data-testid="tarjetas-vencimientos" className="flex flex-col gap-3 md:hidden">
      {vencimientos.map((v) => (
        <li key={v.id} className="flex flex-col gap-2 rounded-lg border p-4">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/vencimientos/${v.id}`} className="font-medium break-words hover:underline">
              {v.impuesto.nombre} · {formatearPeriodo(v.periodo)}
            </Link>
            <EstadoVencimiento estado={v.estadoActual} />
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Vence</dt>
            <dd className="tabular-nums">{formatearFecha(v.fechaVencimiento)}</dd>
            <dt className="text-muted-foreground">Cliente</dt>
            <dd className="min-w-0 break-words">{v.cliente.razonSocial}</dd>
            <dt className="text-muted-foreground">Presentado</dt>
            <dd className="tabular-nums">{formatearFecha(v.fechaPresentacion) || '—'}</dd>
          </dl>
        </li>
      ))}
    </ul>
  );
}

function Vacio({ texto, href, link }: { texto: string; href?: string; link?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-10 text-center">
      <p className="text-muted-foreground">{texto}</p>
      {href && link && (
        <Link href={href} className={buttonVariants({ variant: 'outline' })}>
          {link}
        </Link>
      )}
    </div>
  );
}
