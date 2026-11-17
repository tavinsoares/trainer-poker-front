<script setup lang="ts">
import { computed } from 'vue'
import type { Spot } from '../data/ranges-types.ts'
import { montarMatriz } from '../domain/matriz.ts'

// Matriz 13×13 de um spot (spec 3). Só desenha o modelo de `montarMatriz`: não guarda estado de
// tela. A mão em foco vem de fora, e o mouse e a escolha saem como eventos.

const { spot, focusHand, showLegend = true } = defineProps<{
  spot: Spot
  /** Classe da mão em foco (`A5s`), com contorno branco. */
  focusHand?: string
  showLegend?: boolean
}>()

const emit = defineEmits<{
  /** O mouse entrou numa célula (nome da mão) ou saiu da matriz (`null`). */
  hover: [hand: string | null]
  /** O aluno escolheu uma célula. */
  select: [hand: string]
}>()

const matriz = computed(() => montarMatriz(spot, focusHand))
const linhas = computed(() => Array.from({ length: 13 }, (_, i) => matriz.value.cells.slice(i * 13, i * 13 + 13)))

// 19.5 → "19,5%"; 100 → "100%".
const porcento = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
const combos = (n: number) => `${n} ${n === 1 ? 'combo' : 'combos'}`
</script>

<template>
  <div class="range-matrix">
    <div class="range-matrix__grid" role="grid" :aria-label="`Range do spot ${spot.id}`" @mouseleave="emit('hover', null)">
      <div v-for="(linha, i) in linhas" :key="i" class="range-matrix__row" role="row">
        <div
          v-for="celula in linha"
          :key="celula.hand"
          class="range-matrix__cell"
          :class="[`range-matrix__cell--${celula.color}`, { 'range-matrix__cell--focus': celula.focused }]"
          role="gridcell"
          :aria-label="`${celula.hand}, ${combos(celula.combos)}, ${celula.label}`"
          @mouseenter="emit('hover', celula.hand)"
          @click="emit('select', celula.hand)"
        >
          {{ celula.hand }}
        </div>
      </div>
    </div>

    <ul v-if="showLegend" class="range-matrix__legend">
      <li v-for="entrada in matriz.legend" :key="entrada.action" class="range-matrix__legend-item">
        <span class="range-matrix__swatch" :class="`range-matrix__cell--${entrada.action === 'out_of_range' ? 'out' : entrada.action}`" />
        {{ entrada.label }}
        <span v-if="entrada.percent !== null" class="range-matrix__percent">{{ porcento(entrada.percent) }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.range-matrix {
  --matrix-raise: #a78bfa;
  --matrix-call: #5fd0b6;
  --matrix-fold: #28314a;
  --matrix-jam: #6b46c1;
  --matrix-out: #10151c;
  --matrix-bg: #0b0f14;

  /* O tamanho acompanha o contêiner, e o texto das células acompanha o tamanho delas. */
  container-type: inline-size;
  width: 100%;
}

.range-matrix__grid {
  display: grid;
  gap: 2px;
  font-size: 3cqw;
  font-weight: 600;
  line-height: 1;
  user-select: none;
}

.range-matrix__row {
  display: grid;
  grid-template-columns: repeat(13, 1fr);
  gap: 2px;
}

.range-matrix__cell {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  border-radius: 4px;
  cursor: pointer;
}

.range-matrix__cell--raise {
  background: var(--matrix-raise);
  color: #0b0f14;
}

.range-matrix__cell--call {
  background: var(--matrix-call);
  color: #0b0f14;
}

.range-matrix__cell--fold {
  background: var(--matrix-fold);
  color: #a3aec2;
}

.range-matrix__cell--jam {
  background: var(--matrix-jam);
  color: #ffffff;
}

.range-matrix__cell--out {
  background: var(--matrix-out);
  color: #7d889a;
}

/* Contorno branco de 2px com 2px de espaçamento escuro. */
.range-matrix__cell--focus {
  position: relative;
  z-index: 1;
  box-shadow:
    0 0 0 2px var(--matrix-bg),
    0 0 0 4px #ffffff;
}

.range-matrix__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin: 16px 0 0;
  padding: 0;
  list-style: none;
  color: #a3aec2;
  font-size: 14px;
}

.range-matrix__legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.range-matrix__swatch {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid #232b38;
}

.range-matrix__percent {
  color: #7d889a;
}
</style>
