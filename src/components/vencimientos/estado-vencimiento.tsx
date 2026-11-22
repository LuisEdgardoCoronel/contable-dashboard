import { badgeVariants } from '@/components/ui/badge';
import type { EstadoVencimiento as Estado } from '@/lib/api/types';
import { cn } from '@/lib/utils';
import { ESTADO_VENCIMIENTO } from '@/lib/vencimientos';

/**
 * Badge con el texto del estado y un cuadradito de su color (los mismos tokens
 * que el Inicio). El color nunca es la única pista: siempre va el texto.
 * "Vencido" va en `destructive`. `<span>` común: sirve en Server Components.
 */
export function EstadoVencimiento({ estado, 'data-testid': testId }: { estado: Estado; 'data-testid'?: string }) {
  const { etiqueta, color } = ESTADO_VENCIMIENTO[estado];
  return (
    <span
      data-testid={testId}
      className={cn(
        badgeVariants({ variant: 'outline' }),
        'gap-1.5',
        estado === 'vencido' && 'border-destructive/50 text-destructive',
      )}
    >
      <span aria-hidden className={cn('size-2 shrink-0 rounded-[2px]', color)} />
      {etiqueta}
    </span>
  );
}
