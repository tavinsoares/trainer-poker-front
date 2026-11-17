<script setup lang="ts">
import type { OrigemDosRanges } from '../domain/formato.ts'

// A origem dos ranges: de onde vêm, o que cobrem e a quem recorrer em caso de dúvida.
defineProps<{
  origem: OrigemDosRanges
}>()
</script>

<template>
  <section class="source-notice" aria-labelledby="source-notice-titulo">
    <h2 id="source-notice-titulo" class="source-notice__title">Origem dos ranges</h2>
    <dl class="source-notice__list">
      <div class="source-notice__row">
        <dt>Fonte</dt>
        <dd>{{ origem.fonte }}</dd>
      </div>
      <div class="source-notice__row">
        <dt>Formato</dt>
        <dd>{{ origem.formato }}</dd>
      </div>
      <div class="source-notice__row">
        <dt>Spots disponíveis</dt>
        <dd>{{ origem.spots }} ({{ origem.contraRegular }} contra regular, {{ origem.contraFish }} contra fish)</dd>
      </div>
      <div class="source-notice__row">
        <dt>Importado em</dt>
        <dd>{{ origem.importadoEm }}</dd>
      </div>
      <div class="source-notice__row">
        <dt>EV</dt>
        <dd>só contra regular</dd>
      </div>
    </dl>
    <p class="source-notice__note">Os ranges são os do material do Metagame. Dúvidas sobre o conteúdo, fale com quem mantém a planilha.</p>
  </section>
</template>

<style scoped>
.source-notice {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
}

.source-notice__title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.source-notice__list {
  display: flex;
  flex-direction: column;
  margin: 0;
}

.source-notice__row {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  font-size: 14px;
}

.source-notice__row dt {
  color: var(--text-faint);
}

.source-notice__row dd {
  margin: 0;
  color: var(--text);
  text-align: right;
}

.source-notice__note {
  margin: 0;
  color: var(--text-faint);
  font-size: 13px;
}
</style>
