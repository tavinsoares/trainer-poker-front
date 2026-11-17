<script setup lang="ts">
import { percentualBr } from '../domain/formato.ts'
import type { LinhaDeErro } from '../domain/leaks.ts'

// Uma lista de barras de taxa de erro (vilão, posição ou tipo de spot). Todas as listas usam a
// mesma escala (0 a 100%), então as barras se comparam entre os blocos. O número também vem em
// texto, para a cor e o tamanho não serem a única pista.
defineProps<{
  titulo: string
  linhas: LinhaDeErro[]
}>()
</script>

<template>
  <section class="error-bar-list" :aria-label="titulo">
    <h2 class="error-bar-list__title">{{ titulo }}</h2>
    <ul class="error-bar-list__items">
      <li v-for="linha in linhas" :key="linha.chave" class="error-bar-list__item">
        <span class="error-bar-list__name">{{ linha.rotulo }}</span>
        <span class="error-bar-list__track" aria-hidden="true">
          <span class="error-bar-list__fill" :style="{ width: `${linha.taxaDeErro ?? 0}%` }" />
        </span>
        <span v-if="linha.taxaDeErro !== null" class="error-bar-list__value">
          {{ percentualBr(linha.taxaDeErro) }} <span class="error-bar-list__count">· {{ linha.erros }} de {{ linha.tentativas }}</span>
        </span>
        <span v-else class="error-bar-list__value error-bar-list__value--empty">sem respostas</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.error-bar-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
}

.error-bar-list__title {
  margin: 0;
  color: var(--text-faint);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.error-bar-list__items {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.error-bar-list__item {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) 140px;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.error-bar-list__name {
  color: var(--text-muted);
}

.error-bar-list__track {
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface-2);
}

.error-bar-list__fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: var(--result-error);
}

.error-bar-list__value {
  color: var(--text);
  font-weight: 600;
  text-align: right;
}

.error-bar-list__value--empty {
  color: var(--text-faint);
  font-weight: 400;
}

.error-bar-list__count {
  color: var(--text-faint);
  font-weight: 400;
}

@media (max-width: 600px) {
  .error-bar-list__item {
    grid-template-columns: 64px minmax(0, 1fr);
  }

  .error-bar-list__value {
    grid-column: 1 / -1;
    text-align: left;
  }
}
</style>
