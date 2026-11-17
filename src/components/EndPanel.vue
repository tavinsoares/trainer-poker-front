<script setup lang="ts">
import type { ResumoDaSessao } from '../domain/sessao.ts'

// O resumo da sessão encerrada, com a saída para uma nova.
const { resumo } = defineProps<{
  resumo: ResumoDaSessao
}>()

defineEmits<{
  nova: []
}>()

const taxa = () => (resumo.taxa === null ? '—' : `${String(resumo.taxa).replace('.', ',')}%`)
</script>

<template>
  <section class="end-panel" aria-label="Sessão encerrada">
    <h1 class="end-panel__title">Sessão encerrada</h1>
    <dl class="end-panel__stats">
      <div class="end-panel__stat"><dt>Respostas</dt><dd>{{ resumo.respostas }}</dd></div>
      <div class="end-panel__stat"><dt>Corretas</dt><dd>{{ resumo.corretas }}</dd></div>
      <div class="end-panel__stat"><dt>Erros</dt><dd>{{ resumo.erros }}</dd></div>
      <div class="end-panel__stat"><dt>Taxa de acerto</dt><dd>{{ taxa() }}</dd></div>
      <div class="end-panel__stat"><dt>Maior sequência</dt><dd>{{ resumo.maiorSequencia }}</dd></div>
    </dl>
    <button type="button" class="end-panel__new" @click="$emit('nova')">Nova sessão</button>
  </section>
</template>

<style scoped>
.end-panel {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 20px;
}

.end-panel__title {
  margin: 0;
  font-size: 28px;
}

.end-panel__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
  width: 100%;
  margin: 0;
}

.end-panel__stat {
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
}

.end-panel__stat dt {
  color: var(--text-faint);
  font-size: 12px;
}

.end-panel__stat dd {
  margin: 4px 0 0;
  font-size: 34px;
  font-weight: 700;
}

.end-panel__new {
  padding: 14px 24px;
  border: 0;
  border-radius: 12px;
  background: var(--action-call);
  color: var(--bg);
  font-family: inherit;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
}
</style>
