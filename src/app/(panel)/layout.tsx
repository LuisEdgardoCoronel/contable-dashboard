import { redirect } from 'next/navigation';

import { NavLinks } from '@/components/panel/nav-links';
import { Button } from '@/components/ui/button';
import { getPerfil } from '@/lib/auth/session';

// Cache Components: el panel lee la sesión en cada request y bloquea en el
// servidor (sin streaming), así un 401 redirige con un 307 real.
export const instant = false;

export default async function PanelLayout({ children }: LayoutProps<'/'>) {
  // Un 401 ya redirige a /api/auth/salir desde apiFetch.
  const perfil = await getPerfil();
  // El login ya rechaza al rol cliente; esto cubre una cookie puesta por otra vía.
  if (perfil.rol !== 'admin') redirect('/api/auth/salir');

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b px-4 py-3 sm:px-6">
        <span className="font-semibold">Contable</span>
        {/* En el celular, los links bajan a una segunda fila (order-last + w-full). */}
        <nav aria-label="Principal" className="order-last w-full md:order-none md:w-auto">
          <NavLinks />
        </nav>
        <div className="ml-auto flex min-w-0 items-center gap-3">
          <span className="truncate text-sm text-muted-foreground">Hola, {perfil.nombre}</span>
          <form action="/api/auth/logout" method="post">
            <Button type="submit" variant="outline" size="sm">
              Cerrar sesión
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-4 sm:p-6">{children}</main>
    </div>
  );
}
