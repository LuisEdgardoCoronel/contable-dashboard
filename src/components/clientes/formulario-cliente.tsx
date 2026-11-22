'use client';

import Link from 'next/link';
import { useActionState } from 'react';

import type { EstadoCliente } from '@/app/(panel)/clientes/actions';
import { ariaCampo, Campo, claseSelect, MensajeError } from '@/components/formularios/campo';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CONDICIONES_IVA, type DatosCliente } from '@/lib/clientes';

interface Props {
  /** `crearCliente`, o `actualizarCliente.bind(null, id)`. */
  accion: (previo: EstadoCliente, formData: FormData) => Promise<EstadoCliente>;
  /** Datos actuales (edición). En el alta, vacío. */
  inicial?: Partial<DatosCliente>;
  cancelarHref: string;
}

const AYUDA_CUIT = 'Podés escribirlo con o sin guiones';

/**
 * Alta y edición. Funciona sin JS: `<form action={serverAction}>` se envía como
 * un POST común y la página se vuelve a renderizar con el estado de la action.
 */
export function FormularioCliente({ accion, inicial = {}, cancelarHref }: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  const { errores = {} } = estado;
  // React resetea el form después de la action: los valores vuelven de la action.
  const valores = { ...inicial, ...estado.valores };

  return (
    <form
      // Re-monta los inputs no controlados con los valores devueltos.
      key={JSON.stringify(estado.valores ?? null)}
      action={enviar}
      noValidate
      className="flex max-w-xl flex-col gap-4"
    >
      <MensajeError mensaje={estado.mensaje} />

      <Campo id="razonSocial" etiqueta="Razón social" error={errores.razonSocial}>
        <Input
          {...ariaCampo('razonSocial', { error: errores.razonSocial })}
          name="razonSocial"
          defaultValue={valores.razonSocial}
          maxLength={255}
          autoComplete="organization"
        />
      </Campo>

      <Campo id="cuit" etiqueta="CUIT" ayuda={AYUDA_CUIT} error={errores.cuit}>
        <Input
          {...ariaCampo('cuit', { ayuda: AYUDA_CUIT, error: errores.cuit })}
          name="cuit"
          defaultValue={valores.cuit}
          inputMode="numeric"
          maxLength={15}
          autoComplete="off"
        />
      </Campo>

      <Campo id="email" etiqueta="Email de contacto" error={errores.email}>
        <Input
          {...ariaCampo('email', { error: errores.email })}
          name="email"
          type="email"
          defaultValue={valores.email}
          maxLength={255}
          autoComplete="email"
        />
      </Campo>

      <Campo id="telefono" etiqueta="Teléfono (opcional)" error={errores.telefono}>
        <Input
          {...ariaCampo('telefono', { error: errores.telefono })}
          name="telefono"
          type="tel"
          defaultValue={valores.telefono}
          maxLength={50}
          autoComplete="tel"
        />
      </Campo>

      <Campo id="condicionIVA" etiqueta="Condición frente al IVA" error={errores.condicionIVA}>
        {/* <select> nativo: el Select de shadcn depende de JS. */}
        <select
          {...ariaCampo('condicionIVA', { error: errores.condicionIVA })}
          name="condicionIVA"
          defaultValue={valores.condicionIVA ?? ''}
          className={claseSelect}
        >
          <option value="" disabled>
            Elegí una opción
          </option>
          {CONDICIONES_IVA.map((c) => (
            <option key={c.valor} value={c.valor}>
              {c.etiqueta}
            </option>
          ))}
        </select>
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
