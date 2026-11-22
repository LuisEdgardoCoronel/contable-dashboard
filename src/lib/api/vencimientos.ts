import 'server-only';

import { notFound } from 'next/navigation';
import { cache } from 'react';

import { esUuid } from '@/lib/paginacion';

import { ApiError, apiFetch } from './client';
import type { Impuesto, Vencimiento } from './types';

/**
 * `GET /vencimientos/:id` para el detalle. Un id que no es UUID (la API daría
 * 400) o un vencimiento ajeno o inexistente (404) → `notFound()`. Otros errores
 * se relanzan; el `redirect()` de un 401 no es `ApiError`.
 */
export async function obtenerVencimiento(id: string): Promise<Vencimiento> {
  if (!esUuid(id)) notFound();
  try {
    return await apiFetch<Vencimiento>(`/vencimientos/${id}`);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) notFound();
    throw e;
  }
}

/** `GET /impuestos` (ordenados por nombre), una vez por request. */
export const listarImpuestos = cache(() => apiFetch<Impuesto[]>('/impuestos'));
