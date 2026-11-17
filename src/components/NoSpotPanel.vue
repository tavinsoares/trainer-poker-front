<script setup lang="ts">
// Estado vazio: os filtros não deixam nenhum spot.
defineProps<{
  motivo: string | null
}>()

defineEmits<{
  limpar: []
}>()
</script>

<template>
  <section class="no-spot-panel" aria-label="Nenhum spot">
    <h1 class="no-spot-panel__title">Nenhum spot com esses filtros</h1>
    <p v-if="motivo" class="no-spot-panel__reason">{{ motivo }}</p>
    <button type="button" class="no-spot-panel__clear" @click="$emit('limpar')">Limpar filtros</button>
  </section>
</template>

<style scoped>
.no-spot-panel {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  padding: 32px;
  border: 1px dashed var(--border-strong-2);
  border-radius: 16px;
}

.no-spot-panel__title {
  margin: 0;
  font-size: 24px;
}

.no-spot-panel__reason {
  margin: 0;
  color: var(--text-muted);
}

.no-spot-panel__clear {
  padding: 10px 18px;
  border: 1px solid var(--action-call);
  border-radius: 10px;
  background: var(--selected-bg);
  color: var(--text);
  font-family: inherit;
  font-size: 14px;
  cursor: pointer;
}
</style>
