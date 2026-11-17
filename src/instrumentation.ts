// Se ejecuta una vez al arrancar el servidor: si falta API_URL, Next no levanta.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@/lib/env');
  }
}
