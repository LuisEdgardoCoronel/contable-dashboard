'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition, type FormEvent } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Props {
  desde?: string;
  hasta?: string;
}

/**
 * Formulario GET a `/` con `desde` y `hasta`.
 * - Sin JS: el navegador lo envía como un formulario común (`/?desde=…&hasta=…`).
 * - Con JS: navega con `router.push` dentro de una transición. Como el Inicio
 *   bloquea en el servidor (`instant = false`), la transición queda pendiente
 *   hasta que llegan los datos nuevos, y mientras tanto el botón dice "Aplicando…".
 *   No se usa `next/form` porque no expone ese estado pendiente.
 */
export function FormularioRango({ desde, hasta }: Props) {
  const router = useRouter();
  const [aplicando, startTransition] = useTransition();

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const query = new URLSearchParams();
    for (const clave of ['desde', 'hasta']) {
      const valor = datos.get(clave);
      if (typeof valor === 'string' && valor) query.set(clave, valor);
    }
    const qs = query.toString();
    startTransition(() => router.push(qs ? `/?${qs}` : '/'));
  }

  return (
    // `key`: si el rango cambia por otra vía (Restablecer, atrás/adelante), los
    // inputs no controlados se vuelven a montar con los valores nuevos.
    <form
      key={`${desde ?? ''}|${hasta ?? ''}`}
      action="/"
      method="get"
      onSubmit={enviar}
      aria-label="Rango de los gráficos"
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rango-desde">Desde</Label>
        <Input id="rango-desde" name="desde" type="date" defaultValue={desde} className="sm:w-40" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="rango-hasta">Hasta</Label>
        <Input id="rango-hasta" name="hasta" type="date" defaultValue={hasta} className="sm:w-40" />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={aplicando}>
          {aplicando ? 'Aplicando…' : 'Aplicar'}
        </Button>
        <Link href="/" className={buttonVariants({ variant: 'ghost' })}>
          Restablecer
        </Link>
      </div>
    </form>
  );
}
