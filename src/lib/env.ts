import 'server-only';

function leerApiUrl(): string {
  const valor = process.env.API_URL?.trim();
  if (!valor) {
    throw new Error(
      'Falta la variable de entorno API_URL (por ejemplo, http://localhost:3000). ' +
        'Copiá .env.example a .env.local y completala.',
    );
  }
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new Error(`API_URL no es una URL válida: "${valor}"`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`API_URL tiene que usar http o https: "${valor}"`);
  }
  return valor.replace(/\/+$/, '');
}

export const env = {
  API_URL: leerApiUrl(),
} as const;
