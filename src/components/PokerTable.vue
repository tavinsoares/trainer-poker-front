<script setup lang="ts">
import type { VisaoAssento } from '../domain/visao.ts'
import SeatCard from './SeatCard.vue'

// A mesa com os seis assentos em sentido horário (UTG embaixo à esquerda, depois HJ, CO, BTN, SB e BB).
defineProps<{
  assentos: VisaoAssento[]
  /** "Pote: 3,5bb" (o chip do pote). */
  pote: string
}>()
</script>

<template>
  <div class="poker-table" role="group" aria-label="Mesa">
    <SeatCard v-for="assento in assentos" :key="assento.position" :assento="assento" class="poker-table__seat" :class="`poker-table__seat--${assento.position}`" />
    <div class="poker-table__pot">{{ pote }}</div>
  </div>
</template>

<style scoped>
.poker-table {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-areas:
    'hj co btn'
    'pot pot pot'
    'utg bb sb';
  gap: 12px;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
}

.poker-table__seat--HJ {
  grid-area: hj;
}

.poker-table__seat--CO {
  grid-area: co;
}

.poker-table__seat--BTN {
  grid-area: btn;
}

.poker-table__seat--UTG {
  grid-area: utg;
}

.poker-table__seat--BB {
  grid-area: bb;
}

.poker-table__seat--SB {
  grid-area: sb;
}

.poker-table__pot {
  grid-area: pot;
  justify-self: center;
  padding: 6px 18px;
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--text);
  font-size: 15px;
  font-weight: 700;
}
</style>
