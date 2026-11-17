<script setup lang="ts">
import { computed } from 'vue'

// O cartão da sessão na barra lateral: contador, barra de dois estados (corretas e erros),
// sequência sem erro e o botão de encerrar.
const { corretas, erros } = defineProps<{
  corretas: number
  erros: number
  sequencia: number
}>()

defineEmits<{
  encerrar: []
}>()

const total = computed(() => corretas + erros)
const parteCorreta = computed(() => (total.value === 0 ? 0 : (corretas / total.value) * 100))
</script>

<template>
  <section class="session-summary" aria-label="Sessão">
    <h2 class="session-summary__title">Sessão</h2>
    <p class="session-summary__count">
      <strong class="session-summary__big">{{ corretas }}</strong> de {{ total }} corretas
    </p>
    <div class="session-summary__bar" aria-hidden="true">
      <span class="session-summary__fill session-summary__fill--correct" :style="{ width: `${parteCorreta}%` }" />
      <span v-if="total > 0" class="session-summary__fill session-summary__fill--error" :style="{ width: `${100 - parteCorreta}%` }" />
    </div>
    <p class="session-summary__legend">
      <span class="session-summary__dot session-summary__dot--correct">●</span> {{ corretas }} corretas
      <span class="session-summary__dot session-summary__dot--error">●</span> {{ erros }} erros
    </p>
    <p class="session-summary__streak">
      Sequência sem erro <strong class="session-summary__streak-value">{{ sequencia }}</strong>
    </p>
    <button type="button" class="session-summary__end" @click="$emit('encerrar')">Encerrar sessão</button>
  </section>
</template>

<style scoped>
.session-summary {
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
}

.session-summary__title {
  margin: 0 0 12px;
  color: var(--text-faint);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.session-summary__count {
  margin: 0 0 12px;
  color: var(--text-muted);
  font-size: 14px;
}

.session-summary__big {
  color: var(--text);
  font-size: 34px;
  font-weight: 700;
}

.session-summary__bar {
  display: flex;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface-2);
}

.session-summary__fill--correct {
  background: var(--result-correct);
}

.session-summary__fill--error {
  background: var(--result-error);
}

.session-summary__legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin: 12px 0;
  color: var(--text-muted);
  font-size: 13px;
}

.session-summary__dot--correct {
  color: var(--result-correct);
}

.session-summary__dot--error {
  color: var(--result-error);
}

.session-summary__streak {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin: 0 0 16px;
  color: var(--text-muted);
  font-size: 13px;
}

.session-summary__streak-value {
  color: var(--text);
  font-size: 22px;
}

.session-summary__end {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border-strong-2);
  border-radius: 10px;
  background: transparent;
  color: var(--text-muted);
  font-family: inherit;
  font-size: 14px;
  cursor: pointer;
}

.session-summary__end:hover {
  color: var(--text);
}
</style>
