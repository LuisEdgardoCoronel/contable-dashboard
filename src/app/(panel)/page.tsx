import type { ReactNode } from 'react';

import { FormularioRango } from '@/components/inicio/formulario-rango';
import { GraficoPorImpuesto, GraficoPorMes } from '@/components/inicio/graficos';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError, apiFetch } from '@/lib/api/client';
import type { Estadisticas } from '@/lib/api/types';
import { getPerfil } from '@/lib/auth/session';
import {
  datosPorImpuesto,
  datosPorMes,
  ESTADO_INFO,
  hayVencimientos,
  leerRango,
  type RangoPedido,
} from '@/lib/estadisticas';
import { formatearFecha, formatearFechaLarga } from '@/lib/fechas';
import { cn } from '@/lib/utils';

// Cache Components: cada página del panel lo declara (no se hereda del layout).
export const instant = false;

export const metadata = { title: 'Inicio' };

type Resultado = { ok: true; datos: Estadisticas } | { ok: false; mensaje: string };

/** Un 400 (rango inválido) se muestra en la página; cualquier otro error sigue de largo. */
async function cargar(rango: RangoPedido): Promise<Resultado> {
  try {
    const datos = await apiFetch<Estadisticas>('/estadisticas', { query: { ...rango } });
    return { ok: true, datos };
  } catch (e) {
    // El redirect() de un 401 no es ApiError: se relanza y Next lo maneja.
    if (e instanceof ApiError && e.status === 400) return { ok: false, mensaje: e.message };
    throw e;
  }
}

export default async function InicioPage({ searchParams }: PageProps<'/'>) {
  const pedido = leerRango(await searchParams);
  // getPerfil está en cache(): es la misma llamada que hizo el layout.
  const [{ nombre }, resultado] = await Promise.all([getPerfil(), cargar(pedido)]);

  if (!resultado.ok) {
    return (
      <section className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">Hola, {nombre}</h1>
        <FormularioRango desde={pedido.desde} hasta={pedido.hasta} />
        <div
          role="alert"
          className="rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm"
        >
          <p className="font-medium text-destructive">No se pudo aplicar el rango</p>
          <p data-testid="mensaje-api">{resultado.mensaje}</p>
          <p className="text-muted-foreground">
            Revisá las fechas o tocá &quot;Restablecer&quot; para volver al rango por defecto.
          </p>
        </div>
      </section>
    );
  }

  const { hoy, rango, clientes, vencimientos, porMes, porImpuesto } = resultado.datos;
  const puntosMes = datosPorMes(porMes);
  const puntosImpuesto = datosPorImpuesto(porImpuesto);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Hola, {nombre}</h1>
        <p className="text-sm text-muted-foreground" data-testid="fecha-corte">
          Datos al {formatearFechaLarga(hoy)}
        </p>
      </div>

      <div>
        <h2 className="sr-only">Totales</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Tarjeta
            id="clientes"
            titulo="Clientes activos"
            valor={clientes.activos}
            detalle={`${clientes.inactivos} ${clientes.inactivos === 1 ? 'dado' : 'dados'} de baja`}
          />
          <Tarjeta
            id="pendientes"
            titulo={ESTADO_INFO.pendientes.etiqueta}
            valor={vencimientos.pendientes}
            detalle="Sin presentar y todavía en fecha"
            marca="bg-estado-pendiente"
          />
          <Tarjeta
            id="vencidos"
            titulo={ESTADO_INFO.vencidos.etiqueta}
            valor={vencimientos.vencidos}
            detalle="Sin presentar y con la fecha pasada"
            marca="bg-estado-vencido"
            destacada
          />
          <Tarjeta
            id="presentados"
            titulo={ESTADO_INFO.presentados.etiqueta}
            valor={vencimientos.presentados}
            detalle="Ya presentados"
            marca="bg-estado-presentado"
          />
          <Tarjeta
            id="proximos"
            titulo="Próximos 30 días"
            valor={vencimientos.proximos30Dias}
            detalle="Vencen de hoy a 30 días (clientes activos)"
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Las tarjetas son totales del estudio, sin rango de fechas. El rango aplica solo a los
          gráficos.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Vencimientos en el rango</h2>
          <p className="text-sm text-muted-foreground" data-testid="rango-aplicado">
            Rango: {formatearFecha(rango.desde)} – {formatearFecha(rango.hasta)}
          </p>
        </div>
        <FormularioRango desde={rango.desde} hasta={rango.hasta} />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel
            id="grafico-por-mes"
            titulo="Por mes"
            descripcion="Según el mes de vencimiento"
          >
            {hayVencimientos(puntosMes) ? <GraficoPorMes datos={puntosMes} /> : <SinDatos />}
          </Panel>
          <Panel
            id="grafico-por-impuesto"
            titulo="Por impuesto"
            descripcion="Solo los impuestos con vencimientos en el rango"
          >
            {hayVencimientos(puntosImpuesto) ? (
              <GraficoPorImpuesto datos={puntosImpuesto} />
            ) : (
              <SinDatos />
            )}
          </Panel>
        </div>
      </div>
    </section>
  );
}

function Tarjeta({
  id,
  titulo,
  valor,
  detalle,
  marca,
  destacada = false,
}: {
  id: string;
  titulo: string;
  valor: number;
  detalle: string;
  /** Clase de fondo del color del estado (la misma que usan los gráficos). */
  marca?: string;
  destacada?: boolean;
}) {
  return (
    <Card
      data-testid={`tarjeta-${id}`}
      className={cn(destacada && 'bg-destructive/5 ring-2 ring-destructive/60')}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          {marca && <span aria-hidden className={cn('size-2.5 shrink-0 rounded-[2px]', marca)} />}
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <span
          data-testid="valor"
          className={cn('text-3xl font-semibold tabular-nums', destacada && 'text-destructive')}
        >
          {valor}
        </span>
        <span className="text-xs text-muted-foreground">{detalle}</span>
      </CardContent>
    </Card>
  );
}

function Panel({
  id,
  titulo,
  descripcion,
  children,
}: {
  id: string;
  titulo: string;
  descripcion: string;
  children: ReactNode;
}) {
  return (
    <Card data-testid={id} className="min-w-0">
      <CardHeader>
        <CardTitle>
          <h3>{titulo}</h3>
        </CardTitle>
        <CardDescription>{descripcion}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function SinDatos() {
  return (
    <p className="flex h-48 items-center justify-center text-sm text-muted-foreground">
      No hay vencimientos en este rango
    </p>
  );
}
