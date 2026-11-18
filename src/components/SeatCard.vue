<script setup lang="ts">
import type { VisaoAssento } from '../domain/visao.ts'

// O assento da mesa: o Hero em destaque, quem foldou apagado e sem cartas, e quem agiu ou ainda
// vai agir com as cartas viradas para baixo. Quem o usa o posiciona (as cartas viradas saem por
// trás do topo do assento). O slot padrão é a mão do Hero, que também sai pelo topo, acima do
// assento, qualquer que seja a altura dele.
defineProps<{
  assento: VisaoAssento
}>()
</script>

<template>
  <div class="seat" :class="`seat--${assento.estado}`">
    <span v-if="assento.cartasViradas" class="seat__backs" aria-hidden="true">
      <span class="seat__back"></span>
      <span class="seat__back"></span>
    </span>
    <span v-if="$slots.default" class="seat__hand"><slot /></span>
    <span class="seat__name">{{ assento.titulo }}</span>
    <span class="seat__detail">{{ assento.detalhe }}</span>
  </div>
</template>

<style scoped>
.seat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  background: var(--surface-2);
  text-align: center;
}

.seat__name {
  font-size: clamp(11px, 1.85cqw, 14px);
  font-weight: 700;
}

.seat__detail {
  color: var(--text-muted);
  font-size: clamp(10px, 1.6cqw, 12px);
}

.seat--folded {
  opacity: 0.45;
}

.seat--waiting {
  border-style: dashed;
  border-color: var(--border-strong-2);
  background: transparent;
}

.seat--acted {
  border-color: var(--action-raise);
}

.seat--acted .seat__detail {
  color: var(--action-raise);
  font-weight: 600;
}

.seat--hero {
  border-width: 2px;
  border-color: var(--action-call);
  background: var(--selected-bg);
}

.seat__hand {
  position: absolute;
  bottom: 100%;
  left: 50%;
  margin-bottom: -4px;
  transform: translateX(-50%);
}

.seat__backs {
  position: absolute;
  top: 0;
  left: 50%;
  display: flex;
  transform: translate(-50%, -78%);
}

.seat__back {
  display: block;
  width: clamp(18px, 2.9cqw, 22px);
  aspect-ratio: 22 / 30;
  border: 1px solid #5b6b86;
  border-radius: 4px;
  background: repeating-linear-gradient(45deg, var(--border-strong) 0 3px, #1f2733 3px 6px);
  transform: rotate(-8deg);
}

.seat__back + .seat__back {
  margin-left: -6px;
  transform: rotate(8deg);
}
</style>
