'use client';

import { useActionState } from 'react';

import type { EstadoNotas } from '@/app/(panel)/vencimientos/actions';
import { ariaCampo, Campo, claseTextarea, MensajeError } from '@/components/formularios/campo';
import { Button } from '@/components/ui/button';
import { NOTAS_MAX } from '@/lib/vencimientos';

interface Props {
  /** `guardarNotas.bind(null, id)`. */
  accion: (previo: EstadoNotas, formData: FormData) => Promise<EstadoNotas>;
  notas: string | null;
}

/** Edita las notas. Vaciarlas y guardar las borra. Funciona sin JS. */
export function FormularioNotas({ accion, notas }: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  const error = estado.errores?.notas;
  return (
    <form
      // También con `notas`: después de guardar, el textarea arranca con lo guardado.
      key={JSON.stringify([estado.valores ?? null, notas])}
      action={enviar}
      noValidate
      className="flex flex-col gap-4"
    >
      <MensajeError mensaje={estado.mensaje} />
      <Campo id="notas" etiqueta="Notas" error={error}>
        <textarea
          {...ariaCampo('notas', { error })}
          name="notas"
          defaultValue={estado.valores?.notas ?? notas ?? ''}
          maxLength={NOTAS_MAX}
          rows={4}
          className={claseTextarea}
        />
      </Campo>
      <Button type="submit" disabled={pendiente} className="w-fit">
        {pendiente ? 'Guardando…' : 'Guardar notas'}
      </Button>
    </form>
  );
}
