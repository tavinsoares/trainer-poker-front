# Trainer Poker (front-end)

Drill de decisão preflop para a comunidade do Metagame. Texas Hold'em, cash game, 6-max, 100bb. Site estático, sem back-end. O histórico do aluno fica no navegador.

Specs e decisões ficam no meta-repo (`sdd/` e `docs/`). Este repositório só guarda o código.

## Stack

Vite, Vue 3 (Composition API, `<script setup>`), TypeScript estrito, Pinia e Vitest. Gerenciador de pacotes: npm.

## Comandos

| Comando | O que faz |
|---|---|
| `npm install` | Instala as dependências. |
| `npm run dev` | Sobe o servidor de desenvolvimento. |
| `npm run build` | Checa os tipos e gera o site estático. |
| `npm run typecheck` | Só checa os tipos. |
| `npm run validate:data` | Roda só a suíte de validação dos dados. |
| `npm test` | Roda toda a suíte do Vitest. |

## Estrutura

| Pasta | Propósito |
|---|---|
| `src/` | Código do app (componentes, stores, módulos de domínio). |
| `data/` | JSONs estáticos gerados a partir da planilha do Metagame. Commitados e separados do código. |
| `tools/` | Conversor da planilha (Python), fora do código do app. |
| `tests/` | Testes do Vitest. `tests/data/` valida os JSONs gerados. |

O app nunca lê a planilha em tempo de execução. Ele só lê o JSON de `data/`.

## Convenções

- **Estilo:** CSS `scoped` com BEM, um nome de bloco por componente. Sem biblioteca de componentes de terceiros.
- **Testes:** apenas lógica de domínio (módulos TypeScript puros, separados dos componentes Vue) e validação dos dados. Sem testes de componente nem E2E na v1.
- **Idioma da interface:** português, com os termos de poker em inglês.
