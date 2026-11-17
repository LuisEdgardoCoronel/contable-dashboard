import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

// Con Cache Components, cada segmento que lee la sesión o searchParams declara
// `export const instant = false` (ver CLAUDE.md). No se hereda del layout y
// olvidarlo solo da un aviso en `next dev`, así que lo verifica este test.

const APP = path.join(__dirname);
const CARPETAS = ['(panel)', 'login'];
const ARCHIVO_SEGMENTO = /^(page|layout)\.(tsx|ts|jsx|js)$/;
const INSTANT_FALSE = /^export const instant = false;?\s*$/m;

function segmentos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = path.join(dir, entrada.name);
    if (entrada.isDirectory()) return segmentos(ruta);
    return ARCHIVO_SEGMENTO.test(entrada.name) ? [ruta] : [];
  });
}

const archivos = CARPETAS.flatMap((carpeta) => segmentos(path.join(APP, carpeta)));

describe('instant = false en las rutas autenticadas', () => {
  it('encuentra las páginas a revisar (el chequeo no es vacuo)', () => {
    const relativos = archivos.map((a) => path.relative(APP, a).replaceAll('\\', '/'));
    expect(relativos).toEqual(
      expect.arrayContaining(['(panel)/layout.tsx', '(panel)/page.tsx', 'login/page.tsx']),
    );
  });

  it.each(archivos.map((a) => [path.relative(APP, a).replaceAll('\\', '/'), a]))(
    '%s exporta `instant = false`',
    (_relativo, archivo) => {
      expect(readFileSync(archivo, 'utf8')).toMatch(INSTANT_FALSE);
    },
  );
});
