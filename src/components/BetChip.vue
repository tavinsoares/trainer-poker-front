<script setup lang="ts">
import type { VisaoFicha } from '../domain/visao.ts'

// Uma ficha na mesa: o que o assento já pôs. A aposta é violeta e o blind, azul-acinzentado.
defineProps<{
  ficha: VisaoFicha
}>()
</script>

<template>
  <span class="bet-chip" :class="`bet-chip--${ficha.tipo}`">
    <span class="bet-chip__disc" aria-hidden="true"></span>
    {{ ficha.texto }}
  </span>
</template>

<style scoped>
.bet-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px 3px 4px;
  border: 1px solid var(--border-strong-2);
  border-radius: 999px;
  background: rgba(11, 15, 20, 0.72);
  color: var(--text);
  font-size: clamp(10px, 1.6cqw, 12px);
  font-weight: 700;
  white-space: nowrap;
}

.bet-chip__disc {
  width: 16px;
  height: 16px;
  box-sizing: border-box;
  border: 2px dashed var(--card-face);
  border-radius: 50%;
  background: var(--chip-color);
}

.bet-chip--aposta {
  --chip-color: var(--action-raise);
}

.bet-chip--blind {
  --chip-color: var(--action-fold-accent);
}
</style>
