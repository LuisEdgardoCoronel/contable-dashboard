import Link from 'next/link';

import { FormularioCliente } from '@/components/clientes/formulario-cliente';
import { obtenerCliente } from '@/lib/api/clientes';

import { actualizarCliente } from '../../actions';

// Cache Components: cada página del panel lo declara (no se hereda del layout).
export const instant = false;

export const metadata = { title: 'Editar cliente' };

export default async function EditarClientePage({ params }: PageProps<'/clientes/[id]/editar'>) {
  const { id } = await params;
  const cliente = await obtenerCliente(id);
  const detalle = `/clientes/${cliente.id}`;

  // Un cliente dado de baja también se puede editar; el PUT no manda `activo`.
  return (
    <section className="flex flex-col gap-6">
      <Link href={detalle} className="w-fit text-sm text-muted-foreground hover:underline">
        ← {cliente.razonSocial}
      </Link>
      <h1 className="text-2xl font-semibold">Editar cliente</h1>
      <FormularioCliente
        accion={actualizarCliente.bind(null, cliente.id)}
        inicial={{
          razonSocial: cliente.razonSocial,
          cuit: cliente.cuit,
          email: cliente.email,
          telefono: cliente.telefono ?? '',
          condicionIVA: cliente.condicionIVA,
        }}
        cancelarHref={detalle}
      />
    </section>
  );
}
