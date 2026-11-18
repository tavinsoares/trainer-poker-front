<script setup lang="ts">
import type { VisaoCarta } from '../domain/visao.ts'

// A mão do Hero. O tamanho vem de `--card-w` (padrão 64px) e `leque` inclina as duas cartas,
// como na mesa.
defineProps<{
  cartas: [VisaoCarta, VisaoCarta]
  leque?: boolean
}>()
</script>

<template>
  <div class="hand-cards" :class="{ 'hand-cards--leque': leque }" role="img" :aria-label="`Sua mão: ${cartas[0].rank}${cartas[0].simbolo} ${cartas[1].rank}${cartas[1].simbolo}`">
    <span v-for="(carta, i) in cartas" :key="i" class="hand-cards__card" :class="{ 'hand-cards__card--red': carta.vermelho }" aria-hidden="true">
      <span class="hand-cards__rank">{{ carta.rank }}</span>
      <span class="hand-cards__suit">{{ carta.simbolo }}&#xFE0E;</span>
    </span>
  </div>
</template>

<style scoped>
.hand-cards {
  --largura: var(--card-w, 64px);
  display: inline-flex;
  gap: 8px;
}

.hand-cards__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: var(--largura);
  aspect-ratio: 64 / 88;
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
  font-size: calc(var(--largura) * 0.47);
}

.hand-cards__suit {
  font-size: calc(var(--largura) * 0.41);
}

.hand-cards--leque {
  gap: 6px;
}

.hand-cards--leque .hand-cards__card {
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.5);
}

.hand-cards--leque .hand-cards__card:first-child {
  transform: rotate(-5deg) translateY(2px);
}

.hand-cards--leque .hand-cards__card:last-child {
  transform: rotate(5deg) translateY(2px);
}
</style>
