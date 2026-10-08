import { test, expect, Page } from '@playwright/test';
import { parseBRL } from './helpers';

const grid = (page: Page) => page.locator('#productGrid');
const cards = (page: Page) => page.locator('#productGrid .product-card');

async function openStore(page: Page) {
  await page.goto('loja.html');
  await expect(cards(page).first()).toBeVisible(); // aguarda a API (cold start do Render)
  await expect(page.locator('#categoryFilter option')).not.toHaveCount(1);
}

/** Executa uma ação de filtro e espera a nova resposta da API + render da vitrine. */
async function applyFilter(page: Page, action: () => Promise<unknown>) {
  const response = page.waitForResponse(
    r => r.url().includes('/api/products?') && r.request().method() === 'GET'
  );
  await action();
  await response;
  await expect(page.locator('#productGrid .loading-state')).toHaveCount(0);
}

async function summaryCount(page: Page): Promise<number> {
  const text = (await page.locator('#resultsSummary').textContent()) ?? '';
  const match = text.match(/^(\d+) produto\(s\) encontrado\(s\)$/);
  expect(match, `Resumo inesperado: "${text}"`).not.toBeNull();
  return Number(match![1]);
}

async function allPrices(page: Page): Promise<number[]> {
  const texts = await cards(page).locator('.product-bottom strong').allTextContents();
  return texts.map(parseBRL);
}

test.describe('Cenário 2 - Validar listagem e filtros de produtos (vitrine)', () => {
  test('CT01 - Vitrine lista produtos e o resumo bate com a quantidade de cards', async ({ page }) => {
    await openStore(page);
    expect(await summaryCount(page)).toBe(await cards(page).count());
  });

  test('CT02 - Cada card exibe nome, categoria, ID visual, preço, estoque e loja', async ({ page }) => {
    await openStore(page);
    const total = await cards(page).count();
    for (let i = 0; i < total; i++) {
      const card = cards(page).nth(i);
      await expect(card.locator('h3')).not.toBeEmpty();
      await expect(card.locator('.product-category')).not.toBeEmpty();
      await expect(card.locator('.product-id-badge')).toHaveText(/^PRD-\d{5}$/);
      await expect(card.locator('.product-full-id code')).toHaveText(/^PRD-\d{5}$/);
      await expect(card.locator('.product-bottom strong')).toHaveText(/^R\$\s[\d.]+,\d{2}$/);
      await expect(card.locator('.stock-available, .stock-empty')).toHaveCount(1);
      await expect(card.locator('.product-store-badge')).not.toBeEmpty();
    }
  });

  test('CT03 - ID visual no badge é igual ao código exibido no card', async ({ page }) => {
    await openStore(page);
    const card = cards(page).first();
    const badge = await card.locator('.product-id-badge').textContent();
    const code = await card.locator('.product-full-id code').textContent();
    expect(badge?.trim()).toBe(code?.trim());
  });

  test('CT04 - Produto sem estoque exibe "Esgotado" e botão desabilitado', async ({ page }) => {
    await openStore(page);
    const soldOut = page.locator('#productGrid .product-card', { has: page.locator('.stock-empty') });
    test.skip((await soldOut.count()) === 0, 'Nenhum produto esgotado na massa de dados atual.');
    await expect(soldOut.first().locator('.stock-empty')).toHaveText('Esgotado');
    await expect(soldOut.first().getByRole('button', { name: 'Fora de estoque' })).toBeDisabled();
  });

  test('CT05 - Select de categorias é populado com as categorias da API', async ({ page }) => {
    await openStore(page);
    const options = await page.locator('#categoryFilter option').allTextContents();
    expect(options[0]).toBe('Todas');
    expect(options.length).toBeGreaterThan(1);
  });

  test('CT06 - Filtro por categoria retorna somente produtos da categoria', async ({ page }) => {
    await openStore(page);
    const category = (await page.locator('#categoryFilter option').allTextContents())[1];

    await applyFilter(page, () => page.locator('#categoryFilter').selectOption({ label: category }));

    const total = await cards(page).count();
    expect(total).toBeGreaterThan(0);
    expect(await summaryCount(page)).toBe(total);
    const categories = await cards(page).locator('.product-category').allTextContents();
    for (const c of categories) expect(c.trim()).toBe(category);
  });

  test('CT07 - Busca por nome retorna o produto pesquisado', async ({ page }) => {
    await openStore(page);
    const name = ((await cards(page).first().locator('h3').textContent()) ?? '').trim();

    await applyFilter(page, () => page.locator('#searchInput').fill(name));

    await expect(cards(page).filter({ hasText: name }).first()).toBeVisible();
    expect(await summaryCount(page)).toBe(await cards(page).count());
  });

  test('CT08 - Busca por ID do produto (conforme placeholder do campo)', async ({ page }) => {
    await openStore(page);
    const visualId = ((await cards(page).first().locator('.product-id-badge').textContent()) ?? '').trim();

    await applyFilter(page, () => page.locator('#searchInput').fill(visualId));

    // Esperado: o produto com o ID pesquisado aparece na vitrine.
    await expect(cards(page).filter({ hasText: visualId }).first()).toBeVisible();
  });

  test('CT09 - Busca sem resultado exibe mensagem de vitrine vazia', async ({ page }) => {
    await openStore(page);
    await applyFilter(page, () => page.locator('#searchInput').fill('produto-inexistente-xyz'));

    await expect(page.locator('#productGrid .empty-state')).toHaveText(
      'Nenhum produto encontrado para os filtros atuais.'
    );
    await expect(page.locator('#resultsSummary')).toHaveText('0 produto(s) encontrado(s)');
  });

  test('CT10 - Preço máximo: todos os produtos listados respeitam o limite', async ({ page }) => {
    await openStore(page);
    const prices = (await allPrices(page)).sort((a, b) => a - b);
    const limit = prices[Math.floor(prices.length / 2)] + 0.5; // limite que não coincide com nenhum preço

    await applyFilter(page, () => page.locator('#maxPrice').fill(String(limit)));

    for (const p of await allPrices(page)) expect(p).toBeLessThanOrEqual(limit);
    expect(await summaryCount(page)).toBe(await cards(page).count());
  });

  test('CT11 - Preço máximo é inclusivo: produto com preço IGUAL ao limite deve aparecer', async ({ page }) => {
    await openStore(page);
    const first = cards(page).first();
    const name = ((await first.locator('h3').textContent()) ?? '').trim();
    const price = parseBRL((await first.locator('.product-bottom strong').textContent()) ?? '');

    await applyFilter(page, () => page.locator('#maxPrice').fill(String(price)));

    // Regra esperada: "preço máximo" inclui o valor limite (<=).
    await expect(cards(page).filter({ hasText: name }).first()).toBeVisible();
  });

  test('CT12 - Preço máximo muito baixo exibe vitrine vazia', async ({ page }) => {
    await openStore(page);
    await applyFilter(page, () => page.locator('#maxPrice').fill('1'));
    await expect(page.locator('#productGrid .empty-state')).toBeVisible();
    await expect(page.locator('#resultsSummary')).toHaveText('0 produto(s) encontrado(s)');
  });

  test('CT13 - Filtros combinados (categoria + preço máximo)', async ({ page }) => {
    await openStore(page);
    const category = (await page.locator('#categoryFilter option').allTextContents())[1];
    await applyFilter(page, () => page.locator('#categoryFilter').selectOption({ label: category }));
    const prices = (await allPrices(page)).sort((a, b) => a - b);
    const limit = prices[prices.length - 1] + 1;

    await applyFilter(page, () => page.locator('#maxPrice').fill(String(limit)));

    const cats = await cards(page).locator('.product-category').allTextContents();
    for (const c of cats) expect(c.trim()).toBe(category);
    for (const p of await allPrices(page)) expect(p).toBeLessThanOrEqual(limit);
  });

  test('CT14 - Limpar filtros restaura a listagem completa', async ({ page }) => {
    await openStore(page);
    const initial = await summaryCount(page);

    await applyFilter(page, () => page.locator('#searchInput').fill('produto-inexistente-xyz'));
    await expect(page.locator('#productGrid .empty-state')).toBeVisible();

    await applyFilter(page, () => page.locator('#searchInput').fill(''));
    await expect(cards(page).first()).toBeVisible();
    expect(await summaryCount(page)).toBe(initial);
  });
});
