'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { rutaSegura } from '@/lib/auth/ruta-segura';

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const form = new FormData(evento.currentTarget);
    setEnviando(true);
    setError(null);

    try {
      // Llama al route handler de Next (mismo origen), nunca a la API.
      const respuesta = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      });
      if (respuesta.ok) {
        router.replace(rutaSegura(next));
        return; // queda "Ingresando…" hasta que cambia la página
      }
      const cuerpo = (await respuesta.json().catch(() => null)) as { message?: string } | null;
      setError(cuerpo?.message ?? 'No se pudo conectar con el servidor');
    } catch {
      setError('No se pudo conectar con el servidor');
    }
    setEnviando(false);
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Ingresá al panel</CardTitle>
        <CardDescription>Usá tu cuenta de contador del estudio.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={enviando}>
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
