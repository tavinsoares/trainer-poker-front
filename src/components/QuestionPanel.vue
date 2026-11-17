<script setup lang="ts">
import type { VisaoBotao, VisaoDaPergunta } from '../domain/visao.ts'
import ActionButton from './ActionButton.vue'
import HandCards from './HandCards.vue'
import PokerTable from './PokerTable.vue'
import SpotHeader from './SpotHeader.vue'

// A pergunta: o spot, a situação em texto, os chips, a mesa, a mão e os botões.
const { visao } = defineProps<{
  visao: VisaoDaPergunta
}>()

defineEmits<{
  escolher: [acao: VisaoBotao['action']]
}>()

const pote = () => visao.chips.find((c) => c.id === 'pote')?.texto ?? ''
</script>

<template>
  <section class="question-panel" aria-label="Pergunta">
    <SpotHeader :rotulo="visao.rotulo" :vilao="visao.vilao" />
    <h1 class="question-panel__title">{{ visao.titulo }}</h1>
    <ul class="question-panel__chips">
      <li v-for="chip in visao.chips" :key="chip.id" class="question-panel__chip">{{ chip.texto }}</li>
    </ul>
    <PokerTable :assentos="visao.assentos" :pote="pote()" />
    <div class="question-panel__hand">
      <span class="question-panel__label">Sua mão</span>
      <HandCards :cartas="visao.mao.cartas" />
    </div>
    <div class="question-panel__actions">
      <ActionButton v-for="botao in visao.botoes" :key="botao.action" :botao="botao" @escolher="$emit('escolher', $event)" />
    </div>
  </section>
</template>

<style scoped>
.question-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.question-panel__title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  line-height: 1.2;
}

.question-panel__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.question-panel__chip {
  padding: 6px 14px;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  color: var(--text-muted);
  font-size: 13px;
}

.question-panel__hand {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.question-panel__label {
  color: var(--text-faint);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.question-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

@media (max-width: 900px) {
  .question-panel__title {
    font-size: 22px;
  }
}
</style>
