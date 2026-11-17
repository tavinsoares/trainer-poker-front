<script setup lang="ts">
// O selo do resultado (CORRETA ou ERRO), anunciado para leitor de tela.
defineProps<{
  correta: boolean
  resultado: string
}>()
</script>

<template>
  <div class="result-banner" :class="correta ? 'result-banner--correct' : 'result-banner--error'" role="status" aria-live="polite">
    <span class="result-banner__label">{{ resultado }}</span>
  </div>
</template>

<style scoped>
.result-banner {
  display: inline-block;
  padding: 4px 14px;
  border: 1px solid currentcolor;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.result-banner--correct {
  background: var(--selected-bg);
  color: var(--result-correct);
}

.result-banner--error {
  background: var(--result-error-bg);
  color: var(--result-error);
}
</style>
