import Link from 'next/link';
import type { ReactNode } from 'react';

import { FormularioAccion } from '@/components/formularios/formulario-accion';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EstadoVencimiento, PresentadoTarde } from '@/components/vencimientos/estado-vencimiento';
import { FormularioFechaVencimiento } from '@/components/vencimientos/formulario-fecha-vencimiento';
import { FormularioNotas } from '@/components/vencimientos/formulario-notas';
import { FormularioPresentacion } from '@/components/vencimientos/formulario-presentacion';
import { obtenerVencimiento } from '@/lib/api/vencimientos';
import { formatearCuit } from '@/lib/cuit';
import { formatearFecha, hoyArgentina } from '@/lib/fechas';
import { ESTADO_VENCIMIENTO, formatearPeriodo, leerAvisoVencimiento, presentadoTarde } from '@/lib/vencimientos';

import {
  borrarVencimiento,
  cambiarFechaVencimiento,
  guardarNotas,
  marcarPresentado,
  volverAPendiente,
} from '../actions';

// Cache Components: cada página del panel lo declara (no se hereda del layout).
export const instant = false;

export const metadata = { title: 'Vencimiento' };

export default async function VencimientoPage({ params, searchParams }: PageProps<'/vencimientos/[id]'>) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const v = await obtenerVencimiento(id);
  const aviso = leerAvisoVencimiento(query);
  // La confirmación del borrado va por la URL: funciona con y sin JS.
  const confirmarBorrado = query.confirmar === 'borrar';
  // El cambio de fecha también se abre por la URL (`?editar=fecha`).
  const editarFecha = query.editar === 'fecha';
  const url = `/vencimientos/${v.id}`;
  const titulo = `${v.impuesto.nombre} · ${formatearPeriodo(v.periodo)}`;
  const presentado = v.estadoActual === 'presentado';
  const tarde = presentadoTarde(v);

  return (
    <section className="flex flex-col gap-6">
      <Link href="/vencimientos" className="w-fit text-sm text-muted-foreground hover:underline">
        ← Vencimientos
      </Link>

      {aviso && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-estado-presentado/50 bg-estado-presentado/10 px-4 py-3 text-sm"
        >
          <span className="font-medium">{aviso}</span>
          <Link href={url} className="text-muted-foreground hover:underline">
            Cerrar<span className="sr-only"> aviso</span>
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold break-words">{titulo}</h1>
          <EstadoVencimiento estado={v.estadoActual} data-testid="estado-vencimiento" />
          {tarde && <PresentadoTarde />}
        </div>
        {!confirmarBorrado && (
          <Link href={`${url}?confirmar=borrar`} className={buttonVariants({ variant: 'destructive' })}>
            Borrar
          </Link>
        )}
      </div>

      {confirmarBorrado && (
        <div
          data-testid="confirmar-borrado"
          className="flex flex-col gap-3 rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3"
        >
          <p className="font-medium">
            ¿Borrar el vencimiento de {v.impuesto.nombre} {formatearPeriodo(v.periodo)} de{' '}
            {v.cliente.razonSocial}? No se puede deshacer.
          </p>
          <FormularioAccion
            accion={borrarVencimiento.bind(null, v.id)}
            texto="Sí, borrar"
            textoPendiente="Borrando…"
            variant="destructive"
          >
            <Link href={url} className={buttonVariants({ variant: 'ghost' })}>
              Cancelar
            </Link>
          </FormularioAccion>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Datos</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <dl
            data-testid="datos-vencimiento"
            className="grid grid-cols-1 gap-x-6 gap-y-0.5 text-sm sm:grid-cols-[max-content_1fr] sm:gap-y-3"
          >
            <Dato etiqueta="Cliente">
              <Link href={`/clientes/${v.clienteId}`} className="break-words hover:underline">
                {v.cliente.razonSocial}
              </Link>{' '}
              <span className="text-muted-foreground tabular-nums">({formatearCuit(v.cliente.cuit)})</span>
            </Dato>
            <Dato etiqueta="Impuesto">{v.impuesto.nombre}</Dato>
            <Dato etiqueta="Período">{formatearPeriodo(v.periodo)}</Dato>
            <Dato etiqueta="Fecha de vencimiento">
              {editarFecha ? (
                <FormularioFechaVencimiento
                  accion={cambiarFechaVencimiento.bind(null, v.id)}
                  fecha={v.fechaVencimiento}
                  cancelarHref={url}
                />
              ) : (
                <span className="flex flex-wrap items-baseline gap-x-3">
                  <span className="tabular-nums">{formatearFecha(v.fechaVencimiento)}</span>
                  <Link href={`${url}?editar=fecha`} className="text-muted-foreground hover:underline">
                    Cambiar<span className="sr-only"> la fecha de vencimiento</span>
                  </Link>
                </span>
              )}
            </Dato>
            <Dato etiqueta="Estado">{ESTADO_VENCIMIENTO[v.estadoActual].etiqueta}</Dato>
            <Dato etiqueta="Fecha de presentación">
              <span className="tabular-nums">{formatearFecha(v.fechaPresentacion) || '—'}</span>
            </Dato>
            <Dato etiqueta="Notas">
              {v.notas ? (
                <span className="break-words whitespace-pre-line">{v.notas}</span>
              ) : (
                <span className="text-muted-foreground">Sin notas</span>
              )}
            </Dato>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Estado</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {presentado ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm" data-testid="presentado-el">
                Presentado el {formatearFecha(v.fechaPresentacion)}
              </p>
              {tarde && (
                <p className="text-sm text-destructive" data-testid="presentado-tarde-detalle">
                  Se presentó después de la fecha de vencimiento ({formatearFecha(v.fechaVencimiento)}).
                </p>
              )}
              <FormularioAccion
                accion={volverAPendiente.bind(null, v.id)}
                texto="Volver a pendiente"
                textoPendiente="Guardando…"
                variant="outline"
              />
            </div>
          ) : (
            <FormularioPresentacion accion={marcarPresentado.bind(null, v.id)} hoy={hoyArgentina()} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Notas</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FormularioNotas accion={guardarNotas.bind(null, v.id)} notas={v.notas} />
        </CardContent>
      </Card>
    </section>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{etiqueta}</dt>
      <dd className="mb-2.5 min-w-0 sm:mb-0">{children}</dd>
    </div>
  );
}
