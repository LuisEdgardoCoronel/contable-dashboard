'use client';

import { useActionState } from 'react';

import type { EstadoPresentacion } from '@/app/(panel)/vencimientos/actions';
import { ariaCampo, Campo, MensajeError } from '@/components/formularios/campo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Props {
  /** `marcarPresentado.bind(null, id)`. */
  accion: (previo: EstadoPresentacion, formData: FormData) => Promise<EstadoPresentacion>;
  /** Hoy en Argentina (`YYYY-MM-DD`): no se puede presentar en el futuro. */
  hoy: string;
}

const AYUDA = 'Si la dejás vacía, se usa la fecha de hoy';

/** Marca el vencimiento como presentado, con una fecha opcional. Funciona sin JS. */
export function FormularioPresentacion({ accion, hoy }: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  const error = estado.errores?.fechaPresentacion;
  return (
    <form
      key={JSON.stringify(estado.valores ?? null)}
      action={enviar}
      noValidate
      aria-label="Marcar como presentado"
      className="flex max-w-sm flex-col gap-4"
    >
      <MensajeError mensaje={estado.mensaje} />
      <Campo id="fechaPresentacion" etiqueta="Fecha de presentación" ayuda={AYUDA} error={error}>
        <Input
          {...ariaCampo('fechaPresentacion', { ayuda: AYUDA, error })}
          name="fechaPresentacion"
          type="date"
          max={hoy}
          defaultValue={estado.valores?.fechaPresentacion}
        />
      </Campo>
      <Button type="submit" disabled={pendiente} className="w-fit">
        {pendiente ? 'Guardando…' : 'Marcar como presentado'}
      </Button>
    </form>
  );
}
