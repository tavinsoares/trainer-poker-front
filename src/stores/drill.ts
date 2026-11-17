import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'
import { ranges } from '../data/ranges.ts'
import {
  criarSessao,
  encerrar as encerrarSessao,
  limparFiltros as limparFiltrosDaSessao,
  motivoSemSpot,
  mudarFiltros as mudarFiltrosDaSessao,
  novaSessao as novaSessaoDe,
  proxima as proximaDaSessao,
  responder as responderNaSessao,
  resumo,
  teclar as teclarNaSessao,
  type Dependencias,
  type EventoDeTecla,
  type RegistroDeResposta,
  type Sessao,
} from '../domain/sessao.ts'
import type { AnswerableAction, Filtros } from '../domain/tipos.ts'
import { visaoDaPergunta, visaoDoFeedback } from '../domain/visao.ts'

// Store fino do drill (spec 4): guarda a sessão e chama as operações do domínio. Nenhuma regra de
// negócio mora aqui. A aleatoriedade, o relógio e o gerador de id entram na criação da sessão.

const dependencias: Dependencias = {
  dados: ranges,
  rng: Math.random,
  agora: () => new Date().toISOString(),
  novoId: () => crypto.randomUUID(),
}

type AoRegistrar = (registro: RegistroDeResposta) => void

export const useDrillStore = defineStore('drill', () => {
  // A sessão é um valor imutável: trocá-la por inteiro basta, e não precisa de reatividade profunda.
  const sessao = shallowRef<Sessao>(criarSessao(dependencias))
  /** Gancho opcional chamado a cada resposta registrada (a spec 5 o usa para gravar o histórico). */
  const aoRegistrar = shallowRef<AoRegistrar | null>(null)

  const visaoPergunta = computed(() => (sessao.value.pergunta ? visaoDaPergunta(sessao.value) : null))
  const visaoFeedback = computed(() => (sessao.value.estado === 'respondida' ? visaoDoFeedback(sessao.value) : null))
  const resumoDaSessao = computed(() => resumo(sessao.value))
  const motivo = computed(() => motivoSemSpot(sessao.value))

  /** Troca a sessão e avisa o gancho se uma resposta foi registrada. */
  function aplicar(nova: Sessao) {
    const antes = sessao.value.respostas.length
    sessao.value = nova
    const registro = nova.respostas[antes]
    if (nova.respostas.length > antes && registro) aoRegistrar.value?.(registro)
  }

  const responder = (acao: AnswerableAction) => aplicar(responderNaSessao(sessao.value, acao))
  const proxima = () => aplicar(proximaDaSessao(sessao.value))
  const teclar = (evento: EventoDeTecla) => aplicar(teclarNaSessao(sessao.value, evento))
  const mudarFiltros = (mudanca: Partial<Filtros>) => aplicar(mudarFiltrosDaSessao(sessao.value, mudanca))
  const limparFiltros = () => aplicar(limparFiltrosDaSessao(sessao.value))
  const encerrar = () => aplicar(encerrarSessao(sessao.value))
  const novaSessao = () => aplicar(novaSessaoDe(sessao.value))
  const definirGancho = (gancho: AoRegistrar | null) => {
    aoRegistrar.value = gancho
  }

  return {
    sessao,
    aoRegistrar,
    visaoPergunta,
    visaoFeedback,
    resumoDaSessao,
    motivo,
    responder,
    proxima,
    teclar,
    mudarFiltros,
    limparFiltros,
    encerrar,
    novaSessao,
    definirGancho,
  }
})
