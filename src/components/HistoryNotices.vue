<script setup lang="ts">
import type { Aviso } from '../domain/historico.ts'

// A faixa de avisos do histórico (gravação falhou, dado ilegível, versão mais nova). A região
// existe sempre, mesmo vazia, para o leitor de tela anunciar o aviso quando ele aparecer.
defineProps<{
  avisos: readonly Aviso[]
}>()
</script>

<template>
  <div class="history-notices" role="status" aria-live="polite">
    <p v-for="aviso in avisos" :key="aviso.tipo" class="history-notices__item">{{ aviso.mensagem }}</p>
  </div>
</template>

<style scoped>
.history-notices:empty {
  display: none;
}

.history-notices {
  max-width: 1360px;
  margin: 0 auto;
  padding: 12px 40px 0;
}

.history-notices__item {
  margin: 0 0 8px;
  padding: 12px 16px;
  border: 1px solid var(--notice-border);
  border-radius: 12px;
  background: var(--notice-bg);
  color: var(--villain-fish);
  font-size: 14px;
  line-height: 1.5;
}

@media (max-width: 900px) {
  .history-notices {
    padding: 12px 16px 0;
  }
}
</style>
