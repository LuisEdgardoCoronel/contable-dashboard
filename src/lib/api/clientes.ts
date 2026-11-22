import 'server-only';

import { notFound } from 'next/navigation';

import { esUuid } from '@/lib/paginacion';

import { ApiError, apiFetch } from './client';
import type { Cliente } from './types';

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
