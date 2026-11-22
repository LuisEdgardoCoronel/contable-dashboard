import Link from 'next/link';

import { FiltrosClientes } from '@/components/clientes/filtros-clientes';
import { EstadoBadge } from '@/components/clientes/estado-badge';
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
import { apiFetch } from '@/lib/api/client';
import type { Cliente, Paginado } from '@/lib/api/types';
import {
  etiquetaCondicionIVA,
  hayFiltros,
  leerFiltrosClientes,
  queryClientes,
  urlClientes,
  type FiltrosClientes as Filtros,
} from '@/lib/clientes';
import { formatearCuit } from '@/lib/cuit';

// Cache Components: cada página del panel lo declara (no se hereda del layout).
export const instant = false;

export const metadata = { title: 'Clientes' };

/** Sin buscar ni estado "todos", un listado vacío no dice si el estudio tiene clientes: se pregunta. */
async function estudioSinClientes(filtros: Filtros, total: number): Promise<boolean> {
  if (total > 0 || filtros.buscar) return false;
  if (filtros.estado === 'todos') return true;
  const todos = await apiFetch<Paginado<Cliente>>('/clientes', { query: { limit: 1 } });
  return todos.total === 0;
}

export default async function ClientesPage({ searchParams }: PageProps<'/clientes'>) {
  const filtros = leerFiltrosClientes(await searchParams);
  const { data, total } = await apiFetch<Paginado<Cliente>>('/clientes', {
    query: { ...queryClientes(filtros) },
  });
  const vacio = data.length === 0 && (await estudioSinClientes(filtros, total));

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Clientes</h1>
        <Link href="/clientes/nuevo" className={buttonVariants()}>
          Nuevo cliente
        </Link>
      </div>

      <FiltrosClientes buscar={filtros.buscar} estado={filtros.estado} />

      {vacio ? (
        <Vacio texto="Todavía no cargaste clientes" href="/clientes/nuevo" link="Nuevo cliente" />
      ) : data.length === 0 && filtros.pagina > 1 && total > 0 ? (
        <Vacio
          texto="No hay clientes en esta página"
          href={urlClientes({ ...filtros, pagina: 1 })}
          link="Ir a la página 1"
        />
      ) : data.length === 0 ? (
        <Vacio
          texto="No hay clientes con estos filtros"
          href="/clientes"
          link={hayFiltros(filtros) ? 'Limpiar filtros' : 'Ver todos'}
        />
      ) : (
        <>
          <TablaClientes clientes={data} />
          <TarjetasClientes clientes={data} />
          <Paginas
            pagina={filtros.pagina}
            total={total}
            urlPagina={(pagina) => urlClientes({ ...filtros, pagina })}
            unidad={['cliente', 'clientes']}
          />
        </>
      )}
    </section>
  );
}

function TablaClientes({ clientes }: { clientes: Cliente[] }) {
  return (
    <div className="hidden rounded-lg border md:block">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Razón social</TableHead>
            <TableHead>CUIT</TableHead>
            <TableHead>Condición IVA</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Acceso</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clientes.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-medium">
                <Link href={`/clientes/${c.id}`} className="hover:underline">
                  {c.razonSocial}
                </Link>
              </TableCell>
              <TableCell className="tabular-nums">{formatearCuit(c.cuit)}</TableCell>
              <TableCell>{etiquetaCondicionIVA(c.condicionIVA)}</TableCell>
              <TableCell>{c.email}</TableCell>
              <TableCell>
                <EstadoBadge activo={c.activo} />
              </TableCell>
              <TableCell>{c.usuarioId ? 'Sí' : 'No'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** En el celular: una tarjeta por cliente, sin scroll horizontal. */
function TarjetasClientes({ clientes }: { clientes: Cliente[] }) {
  return (
    <ul data-testid="tarjetas-clientes" className="flex flex-col gap-3 md:hidden">
      {clientes.map((c) => (
        <li key={c.id} className="flex flex-col gap-2 rounded-lg border p-4">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/clientes/${c.id}`} className="font-medium break-words hover:underline">
              {c.razonSocial}
            </Link>
            <EstadoBadge activo={c.activo} />
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-muted-foreground">CUIT</dt>
            <dd className="tabular-nums">{formatearCuit(c.cuit)}</dd>
            <dt className="text-muted-foreground">IVA</dt>
            <dd>{etiquetaCondicionIVA(c.condicionIVA)}</dd>
            <dt className="text-muted-foreground">Email</dt>
            <dd className="min-w-0 break-all">{c.email}</dd>
            <dt className="text-muted-foreground">Acceso</dt>
            <dd>{c.usuarioId ? 'Sí' : 'No'}</dd>
          </dl>
        </li>
      ))}
    </ul>
  );
}

function Vacio({ texto, href, link }: { texto: string; href: string; link: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed px-4 py-10 text-center">
      <p className="text-muted-foreground">{texto}</p>
      <Link href={href} className={buttonVariants({ variant: 'outline' })}>
        {link}
      </Link>
    </div>
  );
}
