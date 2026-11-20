'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SIN_CONEXION = 'No se pudo conectar con el servidor';

export function RegistroForm() {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const form = new FormData(evento.currentTarget);
    setEnviando(true);
    setError(null);

    try {
      // Route handler de Next (mismo origen): registra y loguea. Nunca llama a la API.
      const respuesta = await fetch('/api/auth/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: form.get('nombre'),
          email: form.get('email'),
          password: form.get('password'),
        }),
      });
      const cuerpo = (await respuesta.json().catch(() => null)) as {
        sesion?: boolean;
        message?: string;
      } | null;

      if (respuesta.ok) {
        if (cuerpo?.sesion) {
          router.replace('/');
        } else {
          // La cuenta se creó pero el login automático falló (p. ej. 429).
          toast.info(cuerpo?.message ?? 'Tu cuenta se creó. Ingresá con tu email y contraseña.');
          router.replace('/login');
        }
        return; // queda "Creando cuenta…" hasta que cambia la página
      }
      setError(cuerpo?.message ?? SIN_CONEXION);
    } catch {
      setError(SIN_CONEXION);
    }
    setEnviando(false);
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">Creá tu cuenta</CardTitle>
        <CardDescription>Registrá tu estudio para empezar a usar el panel.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nombre">Nombre</Label>
            <Input
              id="nombre"
              name="nombre"
              autoComplete="name"
              required
              maxLength={255}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={72}
              aria-describedby="password-ayuda"
            />
            <p id="password-ayuda" className="text-xs text-muted-foreground">
              Entre 8 y 72 caracteres.
            </p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={enviando}>
            {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
          </Button>
        </form>
        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
            Ingresá
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
