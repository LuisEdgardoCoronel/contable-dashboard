import { expect, test } from './fixtures';

// El tema sigue `prefers-color-scheme` del sistema operativo (sin botón).

/** Luminancia aproximada (0–1) del fondo del body, a partir del color computado. */
async function luminanciaFondo(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    // El color puede venir en oklch: se lo pasa por un canvas para obtener RGB.
    const color = getComputedStyle(document.body).backgroundColor;
    const ctx = document.createElement('canvas').getContext('2d')!;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  });
}

test.describe('sistema en modo claro', () => {
  test.use({ colorScheme: 'light' });

  test('el fondo es claro', async ({ page }) => {
    await page.goto('/login');
    expect(await luminanciaFondo(page)).toBeGreaterThan(0.8);
  });
});

test.describe('sistema en modo oscuro', () => {
  test.use({ colorScheme: 'dark' });

  test('el fondo es oscuro', async ({ page }) => {
    await page.goto('/login');
    expect(await luminanciaFondo(page)).toBeLessThan(0.2);
  });
});
