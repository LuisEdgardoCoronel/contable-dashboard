'use client';

import { useActionState, type ReactNode } from 'react';

import { MensajeError } from '@/components/formularios/campo';
import { Button } from '@/components/ui/button';
import type { EstadoAccion } from '@/lib/formularios';

interface Props {
  /** P. ej. `darDeBaja.bind(null, id)`. */
  accion: (previo: EstadoAccion, formData: FormData) => Promise<EstadoAccion>;
  texto: string;
  textoPendiente: string;
  variant?: 'default' | 'destructive' | 'outline';
  /** Lo que va al lado del botón (p. ej. el link "Cancelar"). */
  children?: ReactNode;
}

/** Un form de un solo botón para una Server Action sin campos. Funciona sin JS. */
export function FormularioAccion({ accion, texto, textoPendiente, variant, children }: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  return (
    <form action={enviar} className="flex flex-col gap-3">
      <MensajeError mensaje={estado.mensaje} />
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" variant={variant} disabled={pendiente}>
          {pendiente ? textoPendiente : texto}
        </Button>
        {children}
      </div>
    </form>
  );
}
