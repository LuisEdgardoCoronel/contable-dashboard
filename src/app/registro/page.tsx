import type { Metadata } from 'next';

import { RegistroForm } from '@/components/registro-form';

export const metadata: Metadata = {
  title: 'Crear cuenta',
};

// No lee sesión ni searchParams: puede ser estática. Si hay sesión, el proxy
// redirige a / antes de llegar acá.
export default function RegistroPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-4">
      <RegistroForm />
    </main>
  );
}
