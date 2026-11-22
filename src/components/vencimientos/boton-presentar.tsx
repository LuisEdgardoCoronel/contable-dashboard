'use client';

import { useActionState } from 'react';

import { MensajeError } from '@/components/formularios/campo';
import { Button } from '@/components/ui/button';
import type { EstadoAccion } from '@/lib/formularios';

interface Props {
  /** `presentarDesdeListado.bind(null, id, volverA)`. */
  accion: (previo: EstadoAccion, formData: FormData) => Promise<EstadoAccion>;
  /** Qué vencimiento es (p. ej. "IVA octubre 2026, Panadería La Espiga SRL"): hay un botón por fila. */
  contexto: string;
}

/** "Marcar como presentado" de una fila del listado, con la fecha de hoy. Un form por fila: funciona sin JS. */
export function BotonPresentar({ accion, contexto }: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  return (
    <form action={enviar} className="flex flex-col items-start gap-2">
      <Button type="submit" size="sm" variant="outline" disabled={pendiente}>
        {pendiente ? 'Marcando…' : 'Marcar como presentado'}
        <span className="sr-only">({contexto})</span>
      </Button>
      <MensajeError mensaje={estado.mensaje} />
    </form>
  );
}
