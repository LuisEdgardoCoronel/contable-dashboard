import { redirect } from 'next/navigation';

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
      <header className="flex items-center justify-between border-b px-6 py-3">
        <span className="font-semibold">Contable</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{perfil.nombre}</span>
          <form action="/api/auth/logout" method="post">
            <Button type="submit" variant="outline" size="sm">
              Cerrar sesión
            </Button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
