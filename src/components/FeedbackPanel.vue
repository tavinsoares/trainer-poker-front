<script setup lang="ts">
import { onMounted, useTemplateRef } from 'vue'
import type { VisaoDoFeedback } from '../domain/visao.ts'
import EvCard from './EvCard.vue'
import HandCards from './HandCards.vue'
import RangeMatrix from './RangeMatrix.vue'
import ResultBanner from './ResultBanner.vue'
import SpotHeader from './SpotHeader.vue'

// O feedback: à esquerda o resultado, o texto, a ação certa contra a escolha e o EV; à direita a
// matriz do spot com a mão do drill contornada.
defineProps<{
  feedback: VisaoDoFeedback
}>()

defineEmits<{
  proxima: []
}>()

// O foco vai ao "Próximo spot": Enter ou clique seguem o fluxo.
const botaoProximo = useTemplateRef<HTMLButtonElement>('proximo')
onMounted(() => botaoProximo.value?.focus())
</script>

<template>
  <section class="feedback-panel" aria-label="Feedback">
    <div class="feedback-panel__main">
      <SpotHeader :rotulo="feedback.rotulo" :vilao="feedback.pergunta.vilao" />
      <div class="feedback-panel__hand">
        <HandCards :cartas="feedback.mao.cartas" />
        <p class="feedback-panel__chosen">Você escolheu <strong>{{ feedback.escolhida }}</strong></p>
      </div>
      <ResultBanner :correta="feedback.correta" :resultado="feedback.resultado" />
      <h1 class="feedback-panel__title">{{ feedback.titulo }}</h1>
      <p class="feedback-panel__body">{{ feedback.corpo }}</p>

      <div class="feedback-panel__compare">
        <div class="feedback-panel__side feedback-panel__side--right">
          <span class="feedback-panel__side-label">Ação certa</span>
          <strong class="feedback-panel__side-value">{{ feedback.certa }}</strong>
        </div>
        <div class="feedback-panel__side" :class="{ 'feedback-panel__side--wrong': !feedback.correta }">
          <span class="feedback-panel__side-label">Sua escolha</span>
          <strong class="feedback-panel__side-value">{{ feedback.escolhida }}</strong>
        </div>
      </div>

      <EvCard class="feedback-panel__ev" :bloco="feedback.ev" />

      <button ref="proximo" type="button" class="feedback-panel__next" @click="$emit('proxima')">
        Próximo spot <kbd class="feedback-panel__key">Enter</kbd>
      </button>
    </div>

    <aside class="feedback-panel__range" aria-label="Range do spot">
      <h2 class="feedback-panel__range-title">Range do spot</h2>
      <RangeMatrix :spot="feedback.spot" :focus-hand="feedback.maoEmFoco" />
      <p class="feedback-panel__note">{{ feedback.notaDaMatriz }}</p>
      <p class="feedback-panel__note">{{ feedback.procedencia }}</p>
    </aside>
  </section>
</template>

<style scoped>
.feedback-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
  gap: 32px;
  align-items: start;
}

.feedback-panel__main {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}

.feedback-panel__hand {
  display: flex;
  align-items: center;
  gap: 16px;
}

.feedback-panel__chosen {
  margin: 0;
  color: var(--text-muted);
}

.feedback-panel__title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
}

.feedback-panel__body {
  margin: 0;
  color: var(--text-muted);
  font-size: 15px;
  line-height: 1.5;
}

.feedback-panel__compare {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  width: 100%;
}

.feedback-panel__side {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  background: var(--surface);
}

.feedback-panel__side--right {
  border-color: var(--result-correct);
}

.feedback-panel__side--wrong {
  border-color: var(--result-error);
}

.feedback-panel__side-label {
  color: var(--text-faint);
  font-size: 12px;
}

.feedback-panel__side-value {
  font-size: 20px;
}

.feedback-panel__ev {
  align-self: stretch;
}

.feedback-panel__next {
  display: inline-flex;
  align-items: center;
  gap: 12px;
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

.feedback-panel__next:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 3px;
}

.feedback-panel__key {
  padding: 1px 8px;
  border: 1px solid currentcolor;
  border-radius: 6px;
  font-family: ui-monospace, monospace;
  font-size: 12px;
}

.feedback-panel__range {
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
}

.feedback-panel__range-title {
  margin: 0 0 16px;
  color: var(--text-faint);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.feedback-panel__note {
  margin: 12px 0 0;
  color: var(--text-faint);
  font-size: 12px;
}

@media (max-width: 900px) {
  .feedback-panel {
    grid-template-columns: minmax(0, 1fr);
  }

  .feedback-panel__title {
    font-size: 22px;
  }
}
</style>
