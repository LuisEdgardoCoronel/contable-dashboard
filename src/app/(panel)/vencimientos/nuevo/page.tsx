import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { FormularioVencimiento } from '@/components/vencimientos/formulario-vencimiento';
import { todosLosClientes } from '@/lib/api/clientes';
import { listarImpuestos } from '@/lib/api/vencimientos';
import { leerParametro } from '@/lib/paginacion';

import { crearVencimiento } from '../actions';

// Cache Components: cada página del panel lo declara (no se hereda del layout).
export const instant = false;

export const metadata = { title: 'Nuevo vencimiento' };

export default async function NuevoVencimientoPage({ searchParams }: PageProps<'/vencimientos/nuevo'>) {
  const [query, clientes, impuestos] = await Promise.all([searchParams, todosLosClientes(), listarImpuestos()]);
  // La API rechaza los clientes dados de baja: solo se ofrecen los activos.
  const activos = clientes.filter((c) => c.activo).map(({ id, razonSocial }) => ({ id, razonSocial }));
  const pedido = leerParametro(query, 'cliente');
  // `?cliente=<id>` preselecciona (y Cancelar vuelve a su detalle) solo si es un cliente activo.
  const clienteInicial = activos.some((c) => c.id === pedido) ? pedido : undefined;

  return (
    <section className="flex flex-col gap-6">
      <Link href="/vencimientos" className="w-fit text-sm text-muted-foreground hover:underline">
        ← Vencimientos
      </Link>
      <h1 className="text-2xl font-semibold">Nuevo vencimiento</h1>
      {activos.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed px-4 py-6">
          <p className="text-muted-foreground">Para cargar un vencimiento necesitás un cliente activo</p>
          <Link href="/clientes/nuevo" className={buttonVariants({ variant: 'outline' })}>
            Nuevo cliente
          </Link>
        </div>
      ) : (
        <FormularioVencimiento
          accion={crearVencimiento}
          clientes={activos}
          impuestos={impuestos.map(({ id, nombre, periodicidad }) => ({ id, nombre, periodicidad }))}
          clienteInicial={clienteInicial}
          cancelarHref={clienteInicial ? `/clientes/${clienteInicial}` : '/vencimientos'}
        />
      )}
    </section>
  );
}
