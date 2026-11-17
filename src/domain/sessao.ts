import type { Position, RangesData, Spot, SpotFamily, VillainType } from '../data/ranges-types.ts'
import { avaliar } from './avaliacao.ts'
import { sortearPergunta } from './sorteio.ts'
import type { AnswerableAction, Card, Filtros, Question, Rng, Verdict } from './tipos.ts'

// Sessão do drill (spec 4): fluxo contínuo de pergunta, resposta, feedback e próxima. Puro
// TypeScript e imutável: cada operação recebe a sessão e devolve a nova. Sem Vue, sem Pinia, e
// sem `Math.random`, relógio ou geração de id próprios: tudo vem injetado.

/** O que a sessão precisa de fora, para os testes serem determinísticos. */
export interface Dependencias {
  dados: RangesData
  rng: Rng
  /** Data e hora atuais em ISO 8601. */
  agora: () => string
  novoId: () => string
}

/**
 * `perguntando`: há pergunta aberta. `respondida`: há veredito e a pergunta continua visível.
 * `sem-spot`: os filtros não deixam nenhum spot. `encerrada`: o aluno encerrou a sessão.
 */
export type EstadoDaSessao = 'perguntando' | 'respondida' | 'sem-spot' | 'encerrada'

/** O que a spec 5 grava a cada resposta. */
export interface RegistroDeResposta {
  sessionId: string
  /** Data e hora da resposta, ISO 8601. */
  answeredAt: string
  spotId: string
  family: SpotFamily
  hero: Position
  villainType: VillainType
  /** Classe da mão (`A5s`) e as duas cartas que caíram. */
  hand: string
  cards: [Card, Card]
  chosenAction: AnswerableAction
  correctAction: AnswerableAction
  correct: boolean
  ev: number | null
  evLeft: number | null
  edgeHand: boolean
}

export interface Sessao {
  readonly deps: Dependencias
  readonly id: string
  readonly estado: EstadoDaSessao
  readonly filtros: Filtros
  readonly pergunta: Question | null
  readonly veredito: Verdict | null
  readonly corretas: number
  readonly erros: number
  /** Respostas certas seguidas desde o último erro. */
  readonly sequencia: number
  readonly maiorSequencia: number
  /** Os registros da sessão, na ordem das respostas. */
  readonly respostas: readonly RegistroDeResposta[]
}

export const FILTROS_PADRAO: Filtros = { vilao: 'ambos', familias: [], posicoes: [] }

/** Sorteia uma pergunta com os filtros e devolve a sessão no estado que isso dá. */
function sortear(sessao: Sessao): Sessao {
  const pergunta = sortearPergunta(sessao.deps.dados, sessao.deps.rng, sessao.filtros)
  return { ...sessao, pergunta, veredito: null, estado: pergunta ? 'perguntando' : 'sem-spot' }
}

export function criarSessao(deps: Dependencias, filtros: Filtros = FILTROS_PADRAO): Sessao {
  return sortear({
    deps,
    id: deps.novoId(),
    estado: 'perguntando',
    filtros,
    pergunta: null,
    veredito: null,
    corretas: 0,
    erros: 0,
    sequencia: 0,
    maiorSequencia: 0,
    respostas: [],
  })
}

/** Responde a pergunta aberta. Fora de `perguntando`, ou com uma ação que não é botão, não muda nada. */
export function responder(sessao: Sessao, escolhida: AnswerableAction): Sessao {
  const { pergunta } = sessao
  if (sessao.estado !== 'perguntando' || !pergunta) return sessao
  if (!pergunta.options.some((o) => o.action === escolhida)) return sessao

  const veredito = avaliar(sessao.deps.dados, pergunta, escolhida)
  const sequencia = veredito.correct ? sessao.sequencia + 1 : 0
  const registro: RegistroDeResposta = {
    sessionId: sessao.id,
    answeredAt: sessao.deps.agora(),
    spotId: pergunta.spot.id,
    family: pergunta.spot.family,
    hero: pergunta.spot.hero,
    villainType: veredito.villainType,
    hand: pergunta.hand.name,
    cards: pergunta.hand.cards,
    chosenAction: veredito.chosenAction,
    correctAction: veredito.correctAction,
    correct: veredito.correct,
    ev: veredito.ev,
    evLeft: veredito.evLeft,
    edgeHand: veredito.edgeHand,
  }
  return {
    ...sessao,
    estado: 'respondida',
    veredito,
    corretas: sessao.corretas + (veredito.correct ? 1 : 0),
    erros: sessao.erros + (veredito.correct ? 0 : 1),
    sequencia,
    maiorSequencia: Math.max(sessao.maiorSequencia, sequencia),
    respostas: [...sessao.respostas, registro],
  }
}

/** Sorteia a próxima pergunta. Só vale depois da resposta (ou sem spot, para tentar de novo). */
export function proxima(sessao: Sessao): Sessao {
  if (sessao.estado !== 'respondida' && sessao.estado !== 'sem-spot') return sessao
  return sortear(sessao)
}

/** O número da pergunta na sessão: o total respondido mais um enquanto aberta, e o total depois de respondida. */
export function numeroDaPergunta(sessao: Sessao): number {
  return sessao.estado === 'respondida' ? sessao.respostas.length : sessao.respostas.length + 1
}

/** O spot completo da pergunta atual, para a matriz do feedback. */
export function spotDaPergunta(sessao: Sessao): Spot {
  const id = sessao.pergunta?.spot.id
  if (!id) throw new Error('a sessão não tem pergunta')
  const spot = sessao.deps.dados.spots.find((s) => s.id === id)
  if (!spot) throw new Error(`o spot ${id} não existe nos dados`)
  return spot
}

/**
 * Muda os filtros. Em `respondida` o feedback continua e o filtro vale para a próxima. Em
 * `perguntando` a pergunta aberta é descartada sem contar e cai outra dentro do filtro. Em
 * `sem-spot` tenta sortear de novo. Contadores e id não mudam. Encerrada, não faz nada.
 */
export function mudarFiltros(sessao: Sessao, mudanca: Partial<Filtros>): Sessao {
  if (sessao.estado === 'encerrada') return sessao
  const atualizada = { ...sessao, filtros: { ...sessao.filtros, ...mudanca } }
  return sessao.estado === 'respondida' ? atualizada : sortear(atualizada)
}

/** Volta os filtros ao padrão (vilão Ambos, tipo de spot e posição vazios, que valem "todos"). */
export const limparFiltros = (sessao: Sessao): Sessao => mudarFiltros(sessao, FILTROS_PADRAO)

/** A razão provável de os filtros não deixarem nenhum spot, ou `null` fora do estado `sem-spot`. */
export function motivoSemSpot(sessao: Sessao): string | null {
  if (sessao.estado !== 'sem-spot') return null
  const { vilao } = sessao.filtros
  if (vilao !== 'ambos') {
    const outro = vilao === 'fish' ? 'regular' : 'fish'
    const existeNoOutro = sortearPergunta(sessao.deps.dados, () => 0, { ...sessao.filtros, vilao: outro }) !== null
    if (existeNoOutro) return `Não há spot contra ${vilao} com esses filtros, mas há contra ${outro}.`
  }
  return 'Não há spot com esses filtros.'
}

/** Encerra a sessão: a pergunta aberta (ou o feedback na tela) é descartada, sem contar. */
export function encerrar(sessao: Sessao): Sessao {
  if (sessao.estado === 'encerrada') return sessao
  return { ...sessao, estado: 'encerrada', pergunta: null, veredito: null }
}

export interface ResumoDaSessao {
  respostas: number
  corretas: number
  erros: number
  /** Percentual de acerto com uma casa decimal, ou `null` sem respostas. */
  taxa: number | null
  maiorSequencia: number
}

export function resumo(sessao: Sessao): ResumoDaSessao {
  const respostas = sessao.respostas.length
  return {
    respostas,
    corretas: sessao.corretas,
    erros: sessao.erros,
    taxa: respostas === 0 ? null : Math.round((sessao.corretas / respostas) * 1000) / 10,
    maiorSequencia: sessao.maiorSequencia,
  }
}

/** Começa outra sessão depois de encerrar: id novo, contadores zerados e os mesmos filtros. */
export function novaSessao(sessao: Sessao): Sessao {
  if (sessao.estado !== 'encerrada') return sessao
  return criarSessao(sessao.deps, sessao.filtros)
}

/** O que a tela sabe de uma tecla apertada. */
export interface EventoDeTecla {
  key: string
  ctrlKey?: boolean
  altKey?: boolean
  metaKey?: boolean
  /** A tecla foi repetida por ficar pressionada. */
  repeat?: boolean
}

const ACAO_DA_TECLA: Record<string, AnswerableAction> = { f: 'fold', c: 'call', r: 'raise', j: 'jam' }

/**
 * Aplica uma tecla: F, C, R e J respondem (em maiúscula ou minúscula) quando a ação é botão da
 * pergunta, e Enter vai à próxima depois da resposta. O resto é ignorado, e a sessão volta igual.
 * A tela só chama isto quando o foco não está num campo de formulário.
 */
export function teclar(sessao: Sessao, evento: EventoDeTecla): Sessao {
  if (evento.ctrlKey || evento.altKey || evento.metaKey || evento.repeat) return sessao
  if (evento.key === 'Enter') return sessao.estado === 'respondida' ? proxima(sessao) : sessao
  const acao = ACAO_DA_TECLA[evento.key.toLowerCase()]
  return acao ? responder(sessao, acao) : sessao
}
