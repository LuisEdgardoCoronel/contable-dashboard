'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import type { EstadoFechaVencimiento } from '@/app/(panel)/vencimientos/actions';
import { ariaCampo, Campo, MensajeError } from '@/components/formularios/campo';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  /** `cambiarFechaVencimiento.bind(null, id)`. */
  accion: (previo: EstadoFechaVencimiento, formData: FormData) => Promise<EstadoFechaVencimiento>;
  /** La fecha actual (`YYYY-MM-DD`), precargada. */
  fecha: string;
  /** El detalle sin `?editar=fecha`. */
  cancelarHref: string;
}

/** Cambia la fecha de vencimiento. Funciona sin JS. */
export function FormularioFechaVencimiento({ accion, fecha, cancelarHref }: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  const error = estado.errores?.fechaVencimiento;
  return (
    <form
      key={JSON.stringify(estado.valores ?? null)}
      action={enviar}
      noValidate
      aria-label="Cambiar la fecha de vencimiento"
      className="flex max-w-sm flex-col gap-4"
    >
      <MensajeError mensaje={estado.mensaje} />
      <Campo id="fechaVencimiento" etiqueta="Nueva fecha de vencimiento" error={error}>
        <Input
          {...ariaCampo('fechaVencimiento', { error })}
          name="fechaVencimiento"
          type="date"
          defaultValue={estado.valores?.fechaVencimiento ?? fecha}
        />
      </Campo>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pendiente}>
          {pendiente ? 'Guardando…' : 'Guardar fecha'}
        </Button>
        <Link href={cancelarHref} className={buttonVariants({ variant: 'ghost' })}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
