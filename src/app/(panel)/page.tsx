import { getPerfil } from '@/lib/auth/session';

// Cache Components: cada página del panel lo declara (no se hereda del layout).
export const instant = false;

// Placeholder del paso 1: el Inicio con estadísticas llega en el paso 2.
export default async function InicioPage() {
  const { nombre } = await getPerfil(); // misma llamada que el layout (cache)
  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold">Hola, {nombre}</h1>
      <p className="text-muted-foreground">Acá van a estar las estadísticas del estudio.</p>
    </section>
  );
}
