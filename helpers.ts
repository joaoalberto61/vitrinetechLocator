import { expect, Page } from '@playwright/test';

// Massa de dados exibida na tela de login ("Massa de dados para QA")
export const USERS = {
  admin: { email: 'admin@system.com', password: 'AdminPassword123' },
  user: { email: 'user@system.com', password: 'UserPassword123' },
  seller: { email: 'lojista@system.com', password: 'SellerPass123' },
  blocked: { email: 'blocked@system.com', password: 'Blocked123' },
  slow: { email: 'slow@system.com', password: 'SlowPass123' },
};

/** Faz login pela interface. O 1º formulário do DOM é o de login (os outros ficam ocultos). */
export async function login(page: Page, creds: { email: string; password: string }) {
  await page.goto('login.html');
  await page.getByLabel('E-mail').first().fill(creds.email);
  await page.getByLabel('Senha').first().fill(creds.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('token')), { timeout: 60_000 })
    .toBeTruthy();
}

/** Converte "R$ 1.234,56" em 1234.56 */
export function parseBRL(text: string): number {
  return Number(text.replace(/[^\d,]/g, '').replace(',', '.'));
}
