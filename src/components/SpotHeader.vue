<script setup lang="ts">
import type { VillainType } from '../data/ranges-types.ts'
import VillainBadge from './VillainBadge.vue'

defineProps<{
  /** "SPOT 15 · DEFESA DO BB". */
  rotulo: string
  vilao: { tipo: VillainType; rotulo: string }
}>()
</script>

<template>
  <div class="spot-header">
    <span class="spot-header__label">{{ rotulo }}</span>
    <VillainBadge :tipo="vilao.tipo" :rotulo="vilao.rotulo" />
  </div>
</template>

<style scoped>
.spot-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.spot-header__label {
  color: var(--text-faint);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
}
</style>
