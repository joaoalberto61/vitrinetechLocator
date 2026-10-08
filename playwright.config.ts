import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // A API roda no Render (plano gratuito) e pode levar ~1 min para "acordar".
  timeout: 90_000,
  expect: { timeout: 30_000 },
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    // A barra final é obrigatória para os caminhos relativos funcionarem.
    baseURL: 'https://alisonmelo.github.io/tioalison-pe-t4-fap26/projetos-base/01-sistema-login/',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    locale: 'pt-BR',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
