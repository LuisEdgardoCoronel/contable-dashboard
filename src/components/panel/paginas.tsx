import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { calcularPaginacion } from '@/lib/paginacion';
import { cn } from '@/lib/utils';

interface Props {
  pagina: number;
  total: number;
  /** URL del listado en otra página, con los mismos filtros. */
  urlPagina: (pagina: number) => string;
  /** Lo que se cuenta: `['cliente', 'clientes']`. */
  unidad: readonly [singular: string, plural: string];
}

/** Resumen y links "Anterior"/"Siguiente" de un listado paginado. Server Component. */
export function Paginas({ pagina, total, urlPagina, unidad }: Props) {
  const { totalPaginas, hayAnterior, haySiguiente } = calcularPaginacion(total, pagina);
  return (
    <nav aria-label="Paginación" className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground" data-testid="resumen-paginas">
        Página {pagina} de {totalPaginas} · {total} {total === 1 ? unidad[0] : unidad[1]}
      </p>
      <div className="flex gap-2">
        <LinkPagina href={hayAnterior ? urlPagina(pagina - 1) : undefined}>Anterior</LinkPagina>
        <LinkPagina href={haySiguiente ? urlPagina(pagina + 1) : undefined}>Siguiente</LinkPagina>
      </div>
    </nav>
  );
}

/** Sin `href`, se ve deshabilitado y no es un link. */
function LinkPagina({ href, children }: { href?: string; children: string }) {
  const clase = buttonVariants({ variant: 'outline', size: 'sm' });
  if (!href) {
    return (
      <a aria-disabled="true" className={cn(clase, 'pointer-events-none opacity-50')}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={clase}>
      {children}
    </Link>
  );
}
