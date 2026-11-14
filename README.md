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
| `npm run preview` | Serve o build de `npm run build` localmente. |
| `npm run typecheck` | Só checa os tipos. |
| `npm run convert:data` | Regenera o JSON de `data/` a partir da planilha do Metagame. |
| `npm run validate:data` | Roda só a suíte de validação dos dados. |
| `npm test` | Roda toda a suíte do Vitest. |

## Estrutura

| Pasta | Propósito |
|---|---|
| `src/` | Código do app (componentes, stores, módulos de domínio). |
| `data/` | JSONs estáticos gerados a partir da planilha do Metagame. Commitados e separados do código. |
| `tools/` | Conversor da planilha (Python), fora do código do app. |
| `tests/` | Testes do Vitest. `tests/data/` valida os JSONs gerados. |

O app nunca lê a planilha em tempo de execução. Ele só lê o JSON de `data/`. Os tipos desse JSON estão em `src/data/ranges-types.ts`.

## Dados: converter e validar

A planilha fica no meta-repo (`docs/context/`), fora deste repositório. O conversor a procura nesse caminho, ou em outro passado como argumento.

```
pip install -r tools/requirements.txt   # uma vez (Python 3 e openpyxl)
npm run convert:data                    # planilha -> data/ranges.json
npm run validate:data                   # confere as invariantes do JSON
```

Ordem: converter e depois validar. O `data/ranges.json` é commitado, então o build do site não depende de Python nem da planilha. Para outro arquivo, saída ou data: `python tools/convert_ranges.py <planilha.xlsx> --output <saida.json> --imported-at AAAA-MM-DD`. A saída é determinística: duas execuções sobre a mesma planilha só diferem na data de importação.

Nas abas que já trata, o conversor falha com uma mensagem que cita a aba, em vez de adivinhar, quando encontra uma cor que não está na legenda nem nas cores fixas da planilha (cinza e vermelho-escuro), um rótulo de legenda desconhecido, duas entradas de legenda com a mesma cor, uma legenda ausente, uma mão fora da posição da matriz, conteúdo além da matriz 13×13 ou um EV que não é número. Nenhuma aba some sem registro. As abas que ficam de fora da v1 (squeeze, cold 4bet, heads-up, 3-handed e as variantes de tamanho de aposta) vão para `data/ranges.report.json`, com o motivo de cada uma, e o resumo final conta quantas são por motivo. Uma aba que não é spot nem exclusão conhecida faz a conversão falhar, citando a aba: é o aviso de que a planilha ganhou algo novo. O relatório não é lido pelo app. Os tipos dele estão em `src/data/ranges-types.ts`.

## Convenções

- **Estilo:** CSS `scoped` com BEM, um nome de bloco por componente. Sem biblioteca de componentes de terceiros.
- **Testes:** apenas lógica de domínio (módulos TypeScript puros, separados dos componentes Vue) e validação dos dados. Sem testes de componente nem E2E na v1.
- **Idioma da interface:** português, com os termos de poker em inglês.
