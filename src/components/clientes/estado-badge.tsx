import { badgeVariants } from '@/components/ui/badge';

/**
 * "Activo" o "Dado de baja". Usa las clases del `Badge` de shadcn sobre un
 * `<span>` común, así se puede renderizar en Server Components.
 */
export function EstadoBadge({ activo, 'data-testid': testId }: { activo: boolean; 'data-testid'?: string }) {
  return (
    <span
      data-testid={testId}
      className={badgeVariants({ variant: activo ? 'secondary' : 'outline' })}
    >
      {activo ? 'Activo' : 'Dado de baja'}
    </span>
  );
}
