'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';

import type { EstadoVencimientoForm } from '@/app/(panel)/vencimientos/actions';
import { ariaCampo, Campo, claseSelect, claseTextarea, MensajeError } from '@/components/formularios/campo';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ayudaPeriodo, FORMATO_PERIODO, NOTAS_MAX, type Periodicidad } from '@/lib/vencimientos';

interface Props {
  accion: (previo: EstadoVencimientoForm, formData: FormData) => Promise<EstadoVencimientoForm>;
  /** Solo clientes activos: la API rechaza los dados de baja. */
  clientes: { id: string; razonSocial: string }[];
  impuestos: { id: string; nombre: string; periodicidad: Periodicidad }[];
  /** `?cliente=<id>` (desde el detalle del cliente), si está entre los activos. */
  clienteInicial?: string;
  cancelarHref: string;
}

/**
 * Alta de un vencimiento. Funciona sin JS (POST común; la ayuda del período es
 * la general). Con JS, al elegir el impuesto la ayuda y el placeholder pasan al
 * formato de su periodicidad. La validación corre en la action y en la API.
 */
export function FormularioVencimiento({ accion, clientes, impuestos, clienteInicial, cancelarHref }: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  const { errores = {} } = estado;
  // React resetea el form después de la action: los valores vuelven de la action.
  const valores = { clienteId: clienteInicial, ...estado.valores };
  const [impuestoElegido, setImpuestoElegido] = useState(valores.impuestoId ?? '');
  const periodicidad = impuestos.find((i) => i.id === impuestoElegido)?.periodicidad;
  const ayuda = ayudaPeriodo(periodicidad);

  return (
    <form
      // Re-monta los inputs no controlados con los valores devueltos.
      key={JSON.stringify(estado.valores ?? null)}
      action={enviar}
      noValidate
      className="flex max-w-xl flex-col gap-4"
    >
      <MensajeError mensaje={estado.mensaje} />

      <Campo id="clienteId" etiqueta="Cliente" error={errores.clienteId}>
        {/* <select> nativos: el Select de shadcn depende de JS. */}
        <select
          {...ariaCampo('clienteId', { error: errores.clienteId })}
          name="clienteId"
          defaultValue={valores.clienteId ?? ''}
          className={claseSelect}
        >
          <option value="" disabled>
            Elegí un cliente
          </option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.razonSocial}
            </option>
          ))}
        </select>
      </Campo>

      <Campo id="impuestoId" etiqueta="Impuesto" error={errores.impuestoId}>
        <select
          {...ariaCampo('impuestoId', { error: errores.impuestoId })}
          name="impuestoId"
          defaultValue={valores.impuestoId ?? ''}
          onChange={(e) => setImpuestoElegido(e.target.value)}
          className={claseSelect}
        >
          <option value="" disabled>
            Elegí un impuesto
          </option>
          {impuestos.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nombre} ({i.periodicidad})
            </option>
          ))}
        </select>
      </Campo>

      <Campo id="fechaVencimiento" etiqueta="Fecha de vencimiento" error={errores.fechaVencimiento}>
        <Input
          {...ariaCampo('fechaVencimiento', { error: errores.fechaVencimiento })}
          name="fechaVencimiento"
          type="date"
          defaultValue={valores.fechaVencimiento}
        />
      </Campo>

      <Campo id="periodo" etiqueta="Período" ayuda={ayuda} error={errores.periodo}>
        <Input
          {...ariaCampo('periodo', { ayuda, error: errores.periodo })}
          name="periodo"
          defaultValue={valores.periodo}
          placeholder={periodicidad ? FORMATO_PERIODO[periodicidad].ejemplo : undefined}
          maxLength={7}
          autoComplete="off"
        />
      </Campo>

      <Campo id="notas" etiqueta="Notas (opcional)" error={errores.notas}>
        <textarea
          {...ariaCampo('notas', { error: errores.notas })}
          name="notas"
          defaultValue={valores.notas}
          maxLength={NOTAS_MAX}
          rows={3}
          className={claseTextarea}
        />
      </Campo>

      <div className="flex gap-2">
        <Button type="submit" disabled={pendiente}>
          {pendiente ? 'Guardando…' : 'Guardar'}
        </Button>
        <Link href={cancelarHref} className={buttonVariants({ variant: 'ghost' })}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
