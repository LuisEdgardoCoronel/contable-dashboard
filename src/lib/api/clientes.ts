import 'server-only';

import { notFound } from 'next/navigation';
import { cache } from 'react';

import { esUuid } from '@/lib/paginacion';

import { ApiError, apiFetch } from './client';
import type { Cliente, Paginado } from './types';

/**
 * `GET /clientes/:id` para las páginas del detalle y la edición. Un id que no es
 * UUID (la API daría 400) o un cliente ajeno o inexistente (404) → `notFound()`.
 * Otros errores se relanzan; el `redirect()` de un 401 no es `ApiError`.
 */
export async function obtenerCliente(id: string): Promise<Cliente> {
  if (!esUuid(id)) notFound();
  try {
    return await apiFetch<Cliente>(`/clientes/${id}`);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) notFound();
    throw e;
  }
}

/** El máximo de `limit` que acepta la API. */
const LIMITE_API = 100;

/**
 * Todos los clientes del estudio, activos y dados de baja, para los `<select>`
 * de vencimientos (el listado incluye vencimientos de clientes dados de baja).
 * Pide de a 100 y, si hay más, las páginas que falten. Una vez por request.
 */
export const todosLosClientes = cache(async (): Promise<Cliente[]> => {
  const pagina = (page: number) =>
    apiFetch<Paginado<Cliente>>('/clientes', { query: { page, limit: LIMITE_API } });
  const primera = await pagina(1);
  const paginas = Math.ceil(primera.total / LIMITE_API);
  const resto = await Promise.all(Array.from({ length: Math.max(0, paginas - 1) }, (_, i) => pagina(i + 2)));
  return [primera, ...resto].flatMap((p) => p.data);
});
