import type { Metadata } from 'next';

import { LoginForm } from '@/components/login-form';

export const metadata: Metadata = {
  title: 'Ingresar',
};

// Lee searchParams (`next`) en el servidor: ruta dinámica que bloquea.
export const instant = false;

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next } = await searchParams;
  return (
    <main className="flex flex-1 items-center justify-center bg-muted/40 p-4">
      <LoginForm next={typeof next === 'string' ? next : undefined} />
    </main>
  );
}
