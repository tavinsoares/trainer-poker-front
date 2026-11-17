<script setup lang="ts">
import type { VisaoCarta } from '../domain/visao.ts'

defineProps<{
  cartas: [VisaoCarta, VisaoCarta]
}>()
</script>

<template>
  <div class="hand-cards" role="img" :aria-label="`Sua mão: ${cartas[0].rank}${cartas[0].simbolo} ${cartas[1].rank}${cartas[1].simbolo}`">
    <span v-for="(carta, i) in cartas" :key="i" class="hand-cards__card" :class="{ 'hand-cards__card--red': carta.vermelho }" aria-hidden="true">
      <span class="hand-cards__rank">{{ carta.rank }}</span>
      <span class="hand-cards__suit">{{ carta.simbolo }}&#xFE0E;</span>
    </span>
  </div>
</template>

<style scoped>
.hand-cards {
  display: inline-flex;
  gap: 8px;
}

.hand-cards__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 88px;
  border-radius: 8px;
  background: var(--card-face);
  color: #0b0f14;
  font-weight: 700;
  line-height: 1;
}

.hand-cards__card--red {
  color: #c4272d;
}

.hand-cards__rank {
  font-size: 30px;
}

.hand-cards__suit {
  font-size: 26px;
}
</style>
