import { test, expect, Page } from '@playwright/test';
import { login, USERS } from './helpers';

const PAGE_SIZE = 5;

async function openAdminPanel(page: Page) {
  await login(page, USERS.admin);
  await page.goto('painel.html');
  await expect(page.locator('#adminSection')).toBeVisible();
  // Aguarda a carga dos usuários (o contador sai de 0)
  await expect(page.locator('#userCountBadge')).not.toHaveText('0');
  await expect(page.locator('#adminUsersList .user-card').first()).toBeVisible();
}

async function totalFromSummary(page: Page): Promise<number> {
  const text = (await page.locator('#adminUsersSummary').textContent()) ?? '';
  const match = text.match(/^(\d+) usuário\(s\) encontrado\(s\)$/);
  expect(match, `Resumo inesperado: "${text}"`).not.toBeNull();
  return Number(match![1]);
}

test.describe('Cenário 1 - Validar lista de usuários (painel admin)', () => {
  test('CT01 - Admin acessa o painel e vê a aba de usuários', async ({ page }) => {
    await openAdminPanel(page);
    await expect(page.locator('#panelTitle')).toHaveText('Painel Administrativo');
    await expect(page.locator('#roleBadge')).toHaveText('ADMIN');
    await expect(page.locator('#adminTabUsers')).toBeVisible();
  });

  test('CT02 - Contador de usuários é igual ao resumo da listagem (sem filtros)', async ({ page }) => {
    await openAdminPanel(page);
    const badge = Number(await page.locator('#userCountBadge').textContent());
    expect(await totalFromSummary(page)).toBe(badge);
  });

  test('CT03 - Paginação exibe no máximo 5 usuários por página', async ({ page }) => {
    await openAdminPanel(page);
    const total = await totalFromSummary(page);
    const cards = page.locator('#adminUsersList .user-card');

    await expect(cards).toHaveCount(Math.min(total, PAGE_SIZE));

    if (total > PAGE_SIZE) {
      const pages = Math.ceil(total / PAGE_SIZE);
      const pagination = page.locator('#adminUserPagination');
      await expect(pagination).toContainText(`Página 1 de ${pages}`);
      await expect(pagination.getByRole('button', { name: /Anterior/ })).toBeDisabled();

      await pagination.getByRole('button', { name: /Próxima/ }).click();
      await expect(pagination).toContainText(`Página 2 de ${pages}`);
      await expect(pagination.getByRole('button', { name: /Anterior/ })).toBeEnabled();
      const expectedPage2 = Math.min(PAGE_SIZE, total - PAGE_SIZE);
      await expect(cards).toHaveCount(expectedPage2);
    } else {
      await expect(page.locator('#adminUserPagination')).toBeEmpty();
    }
  });

  const seeded = [
    { email: USERS.admin.email, label: 'ADMIN', testUser: true },
    { email: USERS.user.email, label: 'CLIENTE', testUser: true },
    { email: USERS.blocked.email, label: 'BLOQUEADO', testUser: true },
    { email: USERS.slow.email, label: 'CLIENTE', testUser: true },
    { email: USERS.seller.email, label: 'LOJISTA', testUser: false },
  ];

  for (const u of seeded) {
    test(`CT04 - Usuário ${u.email} aparece com o perfil ${u.label}`, async ({ page }) => {
      await openAdminPanel(page);
      await page.locator('#adminUserSearch').fill(u.email);

      const card = page.locator('#adminUsersList .user-card', { hasText: u.email });
      await expect(card).toHaveCount(1);
      await expect(card.locator('.user-card-meta .badge')).toHaveText(u.label);

      // Expande o card e confere os dados do formulário
      await card.locator('.user-card-toggle').click();
      await expect(card.locator('input[data-field="email"]')).toHaveValue(u.email);

      if (u.testUser) {
        await expect(card.locator('.user-card-note')).toContainText('Usuário de teste');
        await expect(card.locator('input[data-field="email"]')).toBeDisabled();
        await expect(card.locator('select[data-field="role"]')).toBeDisabled();
        await expect(card.getByRole('button', { name: 'Salvar Alterações' })).toBeDisabled();
      }
    });
  }

  test('CT05 - Usuário bloqueado exibe o botão "Desbloquear Conta" apenas para não-teste', async ({ page }) => {
    await openAdminPanel(page);
    await page.locator('#adminUserRole').selectOption('blocked');
    await expect(page.locator('#adminUsersList .user-card').first()).toBeVisible();

    const card = page.locator('#adminUsersList .user-card', { hasText: USERS.blocked.email });
    await card.locator('.user-card-toggle').click();
    // blocked@system.com é usuário de teste: edição/desbloqueio não deve estar disponível
    await expect(card.getByRole('button', { name: 'Desbloquear Conta' })).toHaveCount(0);
  });

  const roleFilters = [
    { value: 'admin', label: 'ADMIN', mustExist: true },
    { value: 'user', label: 'CLIENTE', mustExist: true },
    { value: 'blocked', label: 'BLOQUEADO', mustExist: true },
    { value: 'seller', label: 'LOJISTA', mustExist: false },
  ];

  for (const f of roleFilters) {
    test(`CT06 - Filtro por perfil "${f.value}" mostra somente ${f.label}`, async ({ page }) => {
      await openAdminPanel(page);
      await page.locator('#adminUserRole').selectOption(f.value);

      const total = await totalFromSummary(page);
      if (f.mustExist) expect(total).toBeGreaterThan(0);

      if (total === 0) {
        await expect(page.locator('#adminUsersList .empty')).toHaveText(
          'Nenhum usuário encontrado para os filtros selecionados.'
        );
        return;
      }
      const badges = page.locator('#adminUsersList .user-card-meta .badge');
      const count = await badges.count();
      for (let i = 0; i < count; i++) {
        await expect(badges.nth(i)).toHaveText(f.label);
      }
    });
  }

  test('CT07 - Busca por nome/e-mail é case-insensitive e atualiza o resumo', async ({ page }) => {
    await openAdminPanel(page);
    await page.locator('#adminUserSearch').fill('ADMIN@SYSTEM.COM');
    await expect(page.locator('#adminUsersList .user-card', { hasText: USERS.admin.email })).toHaveCount(1);
    expect(await totalFromSummary(page)).toBeGreaterThanOrEqual(1);
  });

  test('CT08 - Busca sem resultado exibe mensagem de lista vazia', async ({ page }) => {
    await openAdminPanel(page);
    await page.locator('#adminUserSearch').fill('xyz-inexistente-123');
    await expect(page.locator('#adminUsersSummary')).toHaveText('0 usuário(s) encontrado(s)');
    await expect(page.locator('#adminUsersList .empty')).toHaveText(
      'Nenhum usuário encontrado para os filtros selecionados.'
    );
  });

  test('CT09 - Busca combinada com filtro de perfil', async ({ page }) => {
    await openAdminPanel(page);
    await page.locator('#adminUserSearch').fill(USERS.user.email);
    await page.locator('#adminUserRole').selectOption('admin');
    // user@system.com é CLIENTE, então não pode aparecer no filtro ADMIN
    await expect(page.locator('#adminUsersSummary')).toHaveText('0 usuário(s) encontrado(s)');
  });

  test('CT10 - Cliente comum não enxerga a área de administração', async ({ page }) => {
    await login(page, USERS.user);
    await page.goto('painel.html');
    await expect(page.locator('#panelTitle')).toHaveText('Minha Conta');
    await expect(page.locator('#adminSection')).toBeHidden();
    await expect(page.locator('#adminUsersList')).toBeHidden();
  });

  test('CT11 - Acesso ao painel sem login redireciona para a tela de login', async ({ page }) => {
    await page.goto('painel.html');
    await expect(page).toHaveURL(/login\.html/);
  });
});
