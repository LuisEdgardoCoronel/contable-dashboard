import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';

export default function VencimientoNoEncontrado() {
  return (
    <section className="flex flex-col items-start gap-4">
      <h1 className="text-2xl font-semibold">Vencimiento no encontrado</h1>
      <p className="text-muted-foreground">
        No existe, ya se borró o no pertenece a tu estudio. Revisá el link o buscalo en el listado.
      </p>
      <Link href="/vencimientos" className={buttonVariants({ variant: 'outline' })}>
        Volver a Vencimientos
      </Link>
    </section>
  );
}
