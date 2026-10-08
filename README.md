# Testes Playwright - LojaQA

Cenários:
1. Validar lista de usuários (`tests/lista-usuarios.spec.ts`) - painel admin
2. Validar listagem e filtros de produtos (`tests/produtos.spec.ts`) - vitrine

## Como executar

```bash
npm install
npx playwright install chromium
npm test              # tudo
npm run test:usuarios # só cenário 1
npm run test:produtos # só cenário 2
npm run report        # abre o relatório HTML
```

## Observações

- A API (`api-qa-fap2026.onrender.com`) está no Render gratuito: a 1ª chamada pode demorar ~1 min.
  Por isso os timeouts estão elevados em `playwright.config.ts`.
- O login usa a massa de dados exibida na própria tela de login (ver `tests/helpers.ts`).
- Os testes de usuários dependem da massa de QA padrão (`admin@`, `user@`, `blocked@`, `slow@`, `lojista@`).

## Defeitos que os testes devem apontar

- **CT11 (produtos)**: o filtro de preço máximo usa `<` em vez de `<=` em `renderProducts()` (`loja.js`),
  então um produto com preço igual ao limite some da lista.
- **CT08 (produtos)**: o placeholder promete busca por "ID do produto"; o ID `PRD-xxxxx` exibido é
  calculado no front, então a API pode não conseguir encontrá-lo. Confirme na primeira execução.
