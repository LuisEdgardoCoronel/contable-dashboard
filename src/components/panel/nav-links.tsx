'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/', texto: 'Inicio' },
  { href: '/clientes', texto: 'Clientes' },
  { href: '/vencimientos', texto: 'Vencimientos' },
] as const;

/** `/` solo en el Inicio; el resto, también en sus subrutas (`/clientes/…`, `/vencimientos/…`). */
function estaActivo(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

const base = 'rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors';

/** Links de la barra. Cliente solo para saber la ruta actual (`usePathname`). */
export function NavLinks() {
  const pathname = usePathname();

  return (
    <ul className="flex items-center gap-1">
      {LINKS.map(({ href, texto }) => {
        const activo = estaActivo(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={activo ? 'page' : undefined}
              className={cn(
                base,
                activo
                  ? 'bg-muted text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              {texto}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
