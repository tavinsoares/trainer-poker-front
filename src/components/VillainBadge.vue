<script setup lang="ts">
import type { VillainType } from '../data/ranges-types.ts'

// Selo do tipo de vilão (compartilhado com o estudo e o leaks): regular neutro, fish em amarelo.
defineProps<{
  tipo: VillainType
  rotulo: string
}>()
</script>

<template>
  <span class="villain-badge" :class="`villain-badge--${tipo}`">{{ rotulo }}</span>
</template>

<style scoped>
.villain-badge {
  display: inline-block;
  padding: 4px 12px;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
}

.villain-badge--fish {
  border-color: var(--villain-fish-border);
  background: var(--villain-fish-bg);
  color: var(--villain-fish);
}
</style>
