'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition, type FormEvent } from 'react';

import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  BUSCAR_MAX,
  ESTADO_FILTRO_DEFAULT,
  ESTADOS_FILTRO,
  ETIQUETA_ESTADO_FILTRO,
  urlClientes,
  type EstadoFiltro,
} from '@/lib/clientes';

import { claseSelect } from './campo';

interface Props {
  buscar?: string;
  estado: EstadoFiltro;
}

/**
 * Formulario GET a `/clientes` (mismo patrón que el rango del Inicio).
 * - Sin JS: GET nativo (`/clientes?buscar=…&estado=…`).
 * - Con JS: `router.push` dentro de una transición; como la página bloquea en el
 *   servidor, el botón dice "Buscando…" hasta que llegan los datos.
 * No incluye `pagina`: cambiar un filtro vuelve a la página 1.
 */
export function FiltrosClientes({ buscar, estado }: Props) {
  const router = useRouter();
  const [buscando, startTransition] = useTransition();

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const texto = datos.get('buscar');
    const elegido = datos.get('estado');
    const url = urlClientes({
      buscar: typeof texto === 'string' ? texto : undefined,
      estado: ESTADOS_FILTRO.find((e) => e === elegido) ?? ESTADO_FILTRO_DEFAULT,
    });
    startTransition(() => router.push(url));
  }

  return (
    // `key`: si los filtros cambian por otra vía (Limpiar, atrás/adelante), los
    // inputs no controlados se vuelven a montar con los valores nuevos.
    <form
      key={`${buscar ?? ''}|${estado}`}
      action="/clientes"
      method="get"
      onSubmit={enviar}
      role="search"
      aria-label="Filtrar clientes"
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div className="flex flex-col gap-1.5 sm:w-72">
        <Label htmlFor="filtro-buscar">Razón social o CUIT</Label>
        <Input
          id="filtro-buscar"
          name="buscar"
          type="search"
          defaultValue={buscar}
          maxLength={BUSCAR_MAX}
        />
      </div>
      <div className="flex flex-col gap-1.5 sm:w-44">
        <Label htmlFor="filtro-estado">Estado</Label>
        {/* <select> nativo: el formulario tiene que funcionar sin JS. */}
        <select id="filtro-estado" name="estado" defaultValue={estado} className={claseSelect}>
          {ESTADOS_FILTRO.map((e) => (
            <option key={e} value={e}>
              {ETIQUETA_ESTADO_FILTRO[e]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={buscando}>
          {buscando ? 'Buscando…' : 'Buscar'}
        </Button>
        <Link href="/clientes" className={buttonVariants({ variant: 'ghost' })}>
          Limpiar
        </Link>
      </div>
    </form>
  );
}
