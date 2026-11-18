<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onBeforeUnmount, onMounted } from 'vue'
import DrillSidebar from '../components/DrillSidebar.vue'
import EndPanel from '../components/EndPanel.vue'
import FeedbackPanel from '../components/FeedbackPanel.vue'
import NoSpotPanel from '../components/NoSpotPanel.vue'
import QuestionPanel from '../components/QuestionPanel.vue'
import { useDrillStore } from '../stores/drill.ts'

// A tela do drill (spec 4): escolhe o painel pelo estado da sessão e liga o teclado. A regra de
// cada tecla é do domínio; aqui só se decide se o foco deixa a tecla valer.
const store = useDrillStore()
const { sessao, visaoPergunta, visaoFeedback, resumoDaSessao, motivo } = storeToRefs(store)

/** Campos de formulário ficam com a tecla; botões e links ficam com o Enter (a ativação nativa). */
function focoOcupado(evento: KeyboardEvent): boolean {
  const alvo = evento.target instanceof HTMLElement ? evento.target : null
  if (!alvo) return false
  if (alvo.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(alvo.tagName)) return true
  return evento.key === 'Enter' && ['BUTTON', 'A'].includes(alvo.tagName)
}

function aoTeclar(evento: KeyboardEvent) {
  if (focoOcupado(evento)) return
  const antes = sessao.value
  store.teclar(evento)
  if (sessao.value !== antes) evento.preventDefault()
}

onMounted(() => window.addEventListener('keydown', aoTeclar))
onBeforeUnmount(() => window.removeEventListener('keydown', aoTeclar))
</script>

<template>
  <main class="drill-view">
    <div class="drill-view__main">
      <EndPanel v-if="sessao.estado === 'encerrada'" :resumo="resumoDaSessao" @nova="store.novaSessao()" />
      <NoSpotPanel v-else-if="sessao.estado === 'sem-spot'" :motivo="motivo" @limpar="store.limparFiltros()" />
      <FeedbackPanel v-else-if="visaoFeedback" :feedback="visaoFeedback" @proxima="store.proxima()" />
      <QuestionPanel v-else-if="visaoPergunta" :visao="visaoPergunta" @escolher="store.responder($event)" />
    </div>
    <DrillSidebar
      :corretas="sessao.corretas"
      :erros="sessao.erros"
      :sequencia="sessao.sequencia"
      :filtros="sessao.filtros"
      :encerrada="sessao.estado === 'encerrada'"
      :mesa="visaoFeedback?.pergunta ?? null"
      @encerrar="store.encerrar()"
      @mudar-filtros="store.mudarFiltros($event)"
    />
  </main>
</template>

<style scoped>
.drill-view {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 340px;
  gap: 32px;
  align-items: start;
  max-width: 1360px;
  margin: 0 auto;
  padding: 32px 40px;
}

@media (max-width: 900px) {
  .drill-view {
    grid-template-columns: minmax(0, 1fr);
    padding: 20px 16px;
  }
}
</style>
