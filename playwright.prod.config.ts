import { defineConfig } from '@playwright/test';

import base from './playwright.config';

// La misma suite, contra un build de producción (`next build` + `next start`) en vez
// de `next dev`. Se corre con `npm run test:e2e:prod`.
// No reusa un servidor que ya esté en el 3001: si hay un `next dev` corriendo, Playwright
// falla avisando que el puerto está ocupado (así nunca se prueba dev creyendo que es prod).
// Para los tests cuyo resultado esperado difiere en producción (el status de notFound()).
// Se setea acá porque Playwright vuelve a cargar este archivo en cada worker.
process.env.E2E_PROD = '1';

export default defineConfig({
  ...base,
  outputDir: 'test-results/prod',
  webServer: {
    command: 'npm run build && npm run start',
    url: 'http://localhost:3001/login',
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
