<script setup lang="ts">
import type { VisaoBotao } from '../domain/visao.ts'

// Botão de ação do drill. Raise e jam têm cor própria, call e fold também; o nome e o atalho
// escritos garantem que a cor não é a única pista.
defineProps<{
  botao: VisaoBotao
}>()

defineEmits<{
  escolher: [acao: VisaoBotao['action']]
}>()
</script>

<template>
  <button
    type="button"
    class="action-button"
    :class="`action-button--${botao.action}`"
    :aria-label="`${botao.nome}: ${botao.subtitulo} (atalho ${botao.atalho})`"
    @click="$emit('escolher', botao.action)"
  >
    <span class="action-button__top">
      <span class="action-button__name">{{ botao.nome }}</span>
      <kbd class="action-button__key">{{ botao.atalho }}</kbd>
    </span>
    <span class="action-button__hint">{{ botao.subtitulo }}</span>
  </button>
</template>

<style scoped>
.action-button {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  justify-content: center;
  gap: 6px;
  min-width: 120px;
  min-height: 76px;
  padding: 12px 16px;
  border: 2px solid transparent;
  border-radius: 12px;
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.action-button:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 2px;
}

.action-button__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.action-button__name {
  font-size: 18px;
  font-weight: 700;
}

.action-button__key {
  padding: 1px 7px;
  border: 1px solid currentcolor;
  border-radius: 6px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
  opacity: 0.8;
}

.action-button__hint {
  font-size: 13px;
  opacity: 0.85;
}

.action-button--fold {
  border-color: var(--action-fold-accent);
  background: var(--action-fold);
  color: var(--text-muted);
}

.action-button--call {
  background: var(--action-call);
  color: var(--bg);
}

.action-button--raise {
  background: var(--action-raise);
  color: var(--bg);
}

.action-button--jam {
  background: var(--action-jam);
  color: #ffffff;
}
</style>
