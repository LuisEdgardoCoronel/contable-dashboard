import Link from 'next/link';

import { FormularioCliente } from '@/components/clientes/formulario-cliente';

import { crearCliente } from '../actions';

// Cache Components: cada página del panel lo declara (no se hereda del layout).
export const instant = false;

export const metadata = { title: 'Nuevo cliente' };

export default function NuevoClientePage() {
  return (
    <section className="flex flex-col gap-6">
      <Link href="/clientes" className="w-fit text-sm text-muted-foreground hover:underline">
        ← Clientes
      </Link>
      <h1 className="text-2xl font-semibold">Nuevo cliente</h1>
      <FormularioCliente accion={crearCliente} cancelarHref="/clientes" />
    </section>
  );
}
