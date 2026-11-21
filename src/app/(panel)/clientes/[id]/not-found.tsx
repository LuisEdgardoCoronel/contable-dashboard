import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';

export default function ClienteNoEncontrado() {
  return (
    <section className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-semibold">Cliente no encontrado</h1>
      <p className="text-muted-foreground">
        No existe o no pertenece a tu estudio. Revisá el link o buscalo en el listado.
      </p>
      <Link href="/clientes" className={buttonVariants({ variant: 'outline' })}>
        Volver a Clientes
      </Link>
    </section>
  );
}
