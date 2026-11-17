<script setup lang="ts">
// Um bloco de métrica: rótulo, número grande e, quando há, o detalhe (porcentagem ou nota).
defineProps<{
  rotulo: string
  valor: string
  detalhe?: string
  tom?: 'neutro' | 'correto' | 'erro'
}>()
</script>

<template>
  <div class="stat-tile" :class="`stat-tile--${tom ?? 'neutro'}`">
    <span class="stat-tile__label">{{ rotulo }}</span>
    <strong class="stat-tile__value">{{ valor }}</strong>
    <span v-if="detalhe" class="stat-tile__detail">{{ detalhe }}</span>
  </div>
</template>

<style scoped>
.stat-tile {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  padding: 16px 20px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
}

.stat-tile__label {
  color: var(--text-faint);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.stat-tile__value {
  font-size: 34px;
  font-weight: 700;
  line-height: 1.1;
}

.stat-tile--correto .stat-tile__value {
  color: var(--result-correct);
}

.stat-tile--erro .stat-tile__value {
  color: var(--result-error);
}

.stat-tile__detail {
  color: var(--text-muted);
  font-size: 13px;
}
</style>
