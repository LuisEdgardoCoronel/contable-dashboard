'use client';

import { useActionState } from 'react';

import type { EstadoAcceso } from '@/app/(panel)/clientes/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { ariaCampo, Campo, MensajeError } from './campo';

interface Props {
  /** `crearAcceso.bind(null, id)`. */
  accion: (previo: EstadoAcceso, formData: FormData) => Promise<EstadoAcceso>;
}

const AYUDA_PASSWORD = 'Entre 8 y 72 caracteres. Pasásela al cliente para que ingrese.';
const AYUDA_NOMBRE = 'Si lo dejás vacío, se usa la razón social';

/** Crea el usuario con el que el cliente entra a su portal. Funciona sin JS. */
export function FormularioAcceso({ accion }: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, {});
  const { errores = {}, valores = {} } = estado;

  return (
    <form
      key={JSON.stringify(estado.valores ?? null)}
      action={enviar}
      noValidate
      aria-label="Crear acceso"
      className="flex max-w-xl flex-col gap-4"
    >
      <MensajeError mensaje={estado.mensaje} />

      <Campo id="acceso-email" etiqueta="Email de login" error={errores.email}>
        <Input
          {...ariaCampo('acceso-email', { error: errores.email })}
          name="email"
          type="email"
          defaultValue={valores.email}
          maxLength={255}
          autoComplete="off"
        />
      </Campo>

      <Campo
        id="acceso-password"
        etiqueta="Contraseña inicial"
        ayuda={AYUDA_PASSWORD}
        error={errores.password}
      >
        <Input
          {...ariaCampo('acceso-password', { ayuda: AYUDA_PASSWORD, error: errores.password })}
          name="password"
          type="password"
          maxLength={72}
          autoComplete="new-password"
        />
      </Campo>

      <Campo id="acceso-nombre" etiqueta="Nombre (opcional)" ayuda={AYUDA_NOMBRE} error={errores.nombre}>
        <Input
          {...ariaCampo('acceso-nombre', { ayuda: AYUDA_NOMBRE, error: errores.nombre })}
          name="nombre"
          defaultValue={valores.nombre}
          maxLength={255}
          autoComplete="off"
        />
      </Campo>

      <div>
        <Button type="submit" disabled={pendiente}>
          {pendiente ? 'Creando…' : 'Crear acceso'}
        </Button>
      </div>
    </form>
  );
}
