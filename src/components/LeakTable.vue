<script setup lang="ts">
import { bbBr, percentualBr } from '../domain/formato.ts'
import type { LinhaDeSpot } from '../domain/leaks.ts'
import VillainBadge from './VillainBadge.vue'

// A tabela "Spots com mais erros". A coluna de EV fica em branco contra fish, em que a planilha
// não traz EV. "Treinar" leva ao drill já filtrado para aquele vilão, tipo de spot e posição.
defineProps<{
  linhas: LinhaDeSpot[]
}>()

defineEmits<{
  treinar: [linha: LinhaDeSpot]
}>()
</script>

<template>
  <div class="leak-table">
    <table class="leak-table__table">
      <caption class="leak-table__caption">Spots com mais erros, do que mais erra para o que menos erra</caption>
      <thead>
        <tr>
          <th scope="col">Spot</th>
          <th scope="col">Vilão</th>
          <th scope="col" class="leak-table__num">Tentativas</th>
          <th scope="col" class="leak-table__num">Taxa de erro</th>
          <th scope="col">Mão</th>
          <th scope="col" class="leak-table__num">EV deixado</th>
          <th scope="col"><span class="leak-table__sr">Ação</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="linha in linhas" :key="linha.spotId">
          <th scope="row" class="leak-table__spot">{{ linha.nome }}</th>
          <td><VillainBadge :tipo="linha.vilao" :rotulo="linha.vilao === 'fish' ? 'Fish' : 'Regular'" /></td>
          <td class="leak-table__num">{{ linha.tentativas }}</td>
          <td class="leak-table__num leak-table__rate">{{ percentualBr(linha.taxaDeErro) }}</td>
          <td class="leak-table__hand">{{ linha.maoMaisErrada }}</td>
          <td class="leak-table__num">{{ linha.evDeixado === null ? '' : bbBr(linha.evDeixado) }}</td>
          <td>
            <button type="button" class="leak-table__train" :aria-label="`Treinar ${linha.nome}, vilão ${linha.vilao}`" @click="$emit('treinar', linha)">
              Treinar
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.leak-table {
  overflow-x: auto;
}

.leak-table__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.leak-table__caption,
.leak-table__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.leak-table__table th,
.leak-table__table td {
  padding: 12px 10px;
  border-bottom: 1px solid var(--border);
  text-align: left;
  white-space: nowrap;
}

.leak-table__table thead th {
  color: var(--text-faint);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.leak-table__spot {
  font-weight: 600;
}

.leak-table__num {
  text-align: right !important;
  font-variant-numeric: tabular-nums;
}

.leak-table__rate {
  color: var(--result-error);
  font-weight: 700;
}

.leak-table__hand {
  font-family: ui-monospace, monospace;
}

.leak-table__train {
  padding: 6px 14px;
  border: 1px solid var(--action-call);
  border-radius: 999px;
  background: transparent;
  color: var(--action-call);
  font-family: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.leak-table__train:hover {
  background: var(--selected-bg);
}

.leak-table__train:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 2px;
}
</style>
