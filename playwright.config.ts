import { defineConfig, devices } from '@playwright/test';

// Credenciales y URL de la API: .env.test (copiar de .env.test.example).
// Si falta, global-setup.ts falla con un mensaje claro.
try {
  process.loadEnvFile('.env.test');
} catch {
  // se valida en global-setup
}

const PUERTO = 3001;

export default defineConfig({
  testDir: './e2e',
  // La API limita el login a LOGIN_RATE_LIMIT/min por IP (la suite usa 6): nada en paralelo y sin reintentos,
  // que gastarían intentos.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: `http://localhost:${PUERTO}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
