<script setup lang="ts">
import type { VisaoAssento } from '../domain/visao.ts'

// Um assento da mesa: o Hero em destaque, quem foldou apagado, quem agiu com a jogada.
defineProps<{
  assento: VisaoAssento
}>()
</script>

<template>
  <div class="seat" :class="`seat--${assento.estado}`">
    <span class="seat__name">{{ assento.titulo }}</span>
    <span class="seat__detail">{{ assento.detalhe }}</span>
  </div>
</template>

<style scoped>
.seat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding: 10px 14px;
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  background: var(--surface-2);
}

.seat__name {
  font-size: 13px;
  font-weight: 700;
}

.seat__detail {
  color: var(--text-muted);
  font-size: 12px;
}

.seat--folded {
  opacity: 0.45;
}

.seat--waiting {
  border-style: dashed;
  background: transparent;
}

.seat--acted {
  border-color: var(--action-raise);
}

.seat--hero {
  border-color: var(--action-call);
  background: var(--selected-bg);
}
</style>
