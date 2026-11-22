import Link from 'next/link';
import type { ReactNode } from 'react';

import { EstadoBadge } from '@/components/clientes/estado-badge';
import { FormularioAcceso } from '@/components/clientes/formulario-acceso';
import { FormularioAccion } from '@/components/formularios/formulario-accion';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { obtenerCliente } from '@/lib/api/clientes';
import { etiquetaCondicionIVA, leerAviso } from '@/lib/clientes';
import { formatearCuit } from '@/lib/cuit';
import { urlVencimientos } from '@/lib/vencimientos';

import { crearAcceso, darDeBaja, reactivarCliente } from '../actions';

// Cache Components: cada página del panel lo declara (no se hereda del layout).
export const instant = false;

export const metadata = { title: 'Cliente' };

export default async function ClientePage({ params, searchParams }: PageProps<'/clientes/[id]'>) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const cliente = await obtenerCliente(id);
  const aviso = leerAviso(query);
  // La confirmación de la baja va por la URL: funciona con y sin JS.
  const confirmarBaja = cliente.activo && query.confirmar === 'baja';
  const url = `/clientes/${cliente.id}`;

  return (
    <section className="flex flex-col gap-6">
      <Link href="/clientes" className="w-fit text-sm text-muted-foreground hover:underline">
        ← Clientes
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
          <h1 className="text-2xl font-semibold break-words">{cliente.razonSocial}</h1>
          <EstadoBadge activo={cliente.activo} data-testid="estado-cliente" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`${url}/editar`} className={buttonVariants({ variant: 'outline' })}>
            Editar
          </Link>
          {cliente.activo && !confirmarBaja && (
            <Link href={`${url}?confirmar=baja`} className={buttonVariants({ variant: 'destructive' })}>
              Dar de baja
            </Link>
          )}
          {!cliente.activo && (
            <FormularioAccion
              accion={reactivarCliente.bind(null, cliente.id)}
              texto="Reactivar"
              textoPendiente="Reactivando…"
            />
          )}
        </div>
      </div>

      {confirmarBaja && (
        <div
          data-testid="confirmar-baja"
          className="flex flex-col gap-3 rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3"
        >
          <p className="font-medium">
            ¿Dar de baja a {cliente.razonSocial}? Va a dejar de poder ingresar con su acceso.
          </p>
          <FormularioAccion
            accion={darDeBaja.bind(null, cliente.id)}
            texto="Sí, dar de baja"
            textoPendiente="Dando de baja…"
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
            data-testid="datos-cliente"
            className="grid grid-cols-1 gap-x-6 gap-y-0.5 text-sm sm:grid-cols-[max-content_1fr] sm:gap-y-3"
          >
            <Dato etiqueta="CUIT">
              <span className="tabular-nums">{formatearCuit(cliente.cuit)}</span>
            </Dato>
            <Dato etiqueta="Condición IVA">{etiquetaCondicionIVA(cliente.condicionIVA)}</Dato>
            <Dato etiqueta="Email de contacto">
              <span className="break-all">{cliente.email}</span>
            </Dato>
            <Dato etiqueta="Teléfono">{cliente.telefono || '—'}</Dato>
            <Dato etiqueta="Estado">{cliente.activo ? 'Activo' : 'Dado de baja'}</Dato>
            <Dato etiqueta="Acceso al portal">{cliente.usuarioId ? 'Sí' : 'No'}</Dato>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Vencimientos</h2>
          </CardTitle>
          {!cliente.activo && (
            <CardDescription>Para cargarle vencimientos nuevos, reactivá el cliente.</CardDescription>
          )}
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {/* Pestaña "Todos": para un solo cliente interesa la historia completa. */}
          <Link
            href={urlVencimientos({ estado: 'todos', cliente: cliente.id })}
            className={buttonVariants({ variant: 'outline' })}
          >
            Ver vencimientos
          </Link>
          {cliente.activo && (
            <Link href={`/vencimientos/nuevo?cliente=${cliente.id}`} className={buttonVariants()}>
              Nuevo vencimiento
            </Link>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Acceso al portal de clientes</h2>
          </CardTitle>
          {!cliente.usuarioId && cliente.activo && (
            <CardDescription>
              Creá un usuario para que el cliente vea sus vencimientos. No va a poder modificar nada.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {cliente.usuarioId ? (
            <p className="text-sm">Tiene acceso al portal de clientes</p>
          ) : cliente.activo ? (
            <FormularioAcceso accion={crearAcceso.bind(null, cliente.id)} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No tiene acceso. Para crearle uno, reactivá el cliente.
            </p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-muted-foreground">{etiqueta}</dt>
      <dd className="mb-2.5 sm:mb-0">{children}</dd>
    </div>
  );
}
