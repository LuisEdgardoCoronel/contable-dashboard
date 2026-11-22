'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition, type FormEvent } from 'react';

import { claseSelect } from '@/components/formularios/campo';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PESTANA_DEFAULT, urlVencimientos, type FiltrosVencimientos as Filtros } from '@/lib/vencimientos';

interface Props {
  filtros: Filtros;
  clientes: { id: string; razonSocial: string; activo: boolean }[];
  impuestos: { id: string; nombre: string }[];
}

/**
 * Formulario GET a `/vencimientos` (mismo patrón que los filtros de clientes).
 * - Sin JS: GET nativo.
 * - Con JS: `router.push` dentro de una transición; el botón dice "Buscando…"
 *   hasta que llegan los datos (la página bloquea en el servidor).
 * La pestaña no se elige acá: va oculta, así filtrar no cambia de pestaña. Sin
 * `pagina`: cambiar un filtro vuelve a la página 1.
 */
export function FiltrosVencimientos({ filtros, clientes, impuestos }: Props) {
  const router = useRouter();
  const [buscando, startTransition] = useTransition();
  const { estado, cliente, impuesto, desde, hasta } = filtros;

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const texto = (clave: string) => {
      const v = datos.get(clave);
      return typeof v === 'string' ? v : undefined;
    };
    const url = urlVencimientos({
      estado,
      cliente: texto('cliente'),
      impuesto: texto('impuesto'),
      desde: texto('desde'),
      hasta: texto('hasta'),
    });
    startTransition(() => router.push(url));
  }

  return (
    // `key`: si los filtros cambian por otra vía (Limpiar, pestañas, atrás/adelante),
    // los inputs no controlados se vuelven a montar con los valores nuevos.
    <form
      key={[estado, cliente, impuesto, desde, hasta].join('|')}
      action="/vencimientos"
      method="get"
      onSubmit={enviar}
      role="search"
      aria-label="Filtrar vencimientos"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end"
    >
      {estado !== PESTANA_DEFAULT && <input type="hidden" name="estado" value={estado} />}
      <div className="flex min-w-0 flex-col gap-1.5 lg:w-64">
        <Label htmlFor="filtro-cliente">Cliente</Label>
        {/* <select> nativo: el formulario tiene que funcionar sin JS. */}
        <select id="filtro-cliente" name="cliente" defaultValue={cliente ?? ''} className={claseSelect}>
          <option value="">Todos</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.activo ? c.razonSocial : `${c.razonSocial} (dado de baja)`}
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 lg:w-48">
        <Label htmlFor="filtro-impuesto">Impuesto</Label>
        <select id="filtro-impuesto" name="impuesto" defaultValue={impuesto ?? ''} className={claseSelect}>
          <option value="">Todos</option>
          {impuestos.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 lg:w-40">
        <Label htmlFor="filtro-desde">Desde</Label>
        <Input id="filtro-desde" name="desde" type="date" defaultValue={desde} />
      </div>
      <div className="flex min-w-0 flex-col gap-1.5 lg:w-40">
        <Label htmlFor="filtro-hasta">Hasta</Label>
        <Input id="filtro-hasta" name="hasta" type="date" defaultValue={hasta} />
      </div>
      <div className="flex gap-2 sm:col-span-2">
        <Button type="submit" disabled={buscando}>
          {buscando ? 'Buscando…' : 'Buscar'}
        </Button>
        <Link href={urlVencimientos({ estado })} className={buttonVariants({ variant: 'ghost' })}>
          Limpiar
        </Link>
      </div>
    </form>
  );
}
