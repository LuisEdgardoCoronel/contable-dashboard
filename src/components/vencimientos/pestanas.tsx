import Link from 'next/link';

import { cn } from '@/lib/utils';
import {
  ETIQUETA_PESTANA,
  PESTANAS,
  urlVencimientos,
  type FiltrosVencimientos,
  type Pestana,
} from '@/lib/vencimientos';

interface Props {
  filtros: FiltrosVencimientos;
  /** Sin conteos (hay otros filtros, o `/estadisticas` falló), las pestañas van sin número. */
  conteos?: Record<Pestana, number>;
}

/**
 * Las cinco pestañas del listado: links comunes (funcionan sin JS). Conservan
 * cliente, impuesto y fechas (salvo "Próximos", que no los acepta) y vuelven a
 * la página 1. En el celular hacen scroll horizontal dentro de su contenedor.
 */
export function Pestanas({ filtros, conteos }: Props) {
  return (
    <nav aria-label="Estado" className="-mx-1 overflow-x-auto px-1 pb-1">
      <ul className="flex w-max gap-1 border-b">
        {PESTANAS.map((pestana) => {
          const activa = pestana === filtros.estado;
          const cantidad = conteos?.[pestana];
          const etiqueta = ETIQUETA_PESTANA[pestana];
          const destacada = pestana === 'vencido' && cantidad !== undefined && cantidad > 0;
          return (
            <li key={pestana}>
              <Link
                href={urlVencimientos({ ...filtros, estado: pestana, pagina: 1 })}
                aria-current={activa ? 'page' : undefined}
                aria-label={cantidad === undefined ? undefined : `${etiqueta}, ${cantidad}`}
                data-destacada={destacada || undefined}
                className={cn(
                  '-mb-px flex items-center gap-1 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
                  'rounded-t-md focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
                  activa
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                  destacada && 'text-destructive hover:text-destructive',
                )}
              >
                {etiqueta}
                {cantidad !== undefined && <span className="tabular-nums">({cantidad})</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
