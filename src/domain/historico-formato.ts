import type { RegistroDeResposta } from './sessao.ts'

// O formato do histórico (spec 5): o envelope com a versão do schema e a validação de cada
// registro. O mesmo código lê o que está no `localStorage` e o que vem de um arquivo importado,
// então um arquivo exportado sempre pode ser importado. Puro TypeScript.

export const APP = 'trainer-poker'
export const VERSAO_DO_SCHEMA = 1

/** O que se grava (e se exporta): o mesmo formato nos dois lugares. */
export interface Envelope {
  app: typeof APP
  schemaVersion: number
  /** Só no arquivo exportado. */
  exportedAt?: string
  respostas: RegistroDeResposta[]
}

/**
 * Migrações de uma versão antiga do schema: cada uma recebe o objeto lido na versão `N` e devolve
 * o da versão `N + 1`. Na v1 só existe a versão 1, então o mapa está vazio.
 */
export type Migracoes = Record<number, (bruto: Record<string, unknown>) => Record<string, unknown>>
export const MIGRACOES: Migracoes = {}

export type ErroDeLeitura =
  | {
      tipo: 'invalido'
      mensagem: string
      /** Número do registro (a partir de 1), quando o erro é de um registro. */
      registro?: number
      campo?: string
    }
  | { tipo: 'versao-mais-nova'; mensagem: string; versao: number }

export type ResultadoDaLeitura =
  | { ok: true; registros: RegistroDeResposta[]; versao: number }
  | { ok: false; erro: ErroDeLeitura }

const POSICOES = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']
const FAMILIAS = ['rfi', '3bet', 'bb-defense', 'vs-3bet', 'vs-4bet', 'vs-jam']
const VILOES = ['regular', 'fish']
const ACOES = ['fold', 'call', 'raise', 'jam']
const NAIPES = ['s', 'h', 'd', 'c']
const RANKS = 'AKQJT98765432'

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const textoNaoVazio = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const numeroFinito = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

interface ProblemaDoRegistro {
  campo: string
  motivo: string
}

const problema = (campo: string, motivo: string): ProblemaDoRegistro => ({ campo, motivo })

/** A mão (`AA`, `AKs`, `AKo`) e as duas cartas combinam: mesmos ranks, e suited só com naipe igual. */
function problemaDaMao(hand: string, cards: { rank: string; suit: string }[]): ProblemaDoRegistro | null {
  const partes = /^([AKQJT98765432])([AKQJT98765432])([so])?$/.exec(hand)
  if (!partes) return problema('hand', `"${hand}" não é uma classe de mão`)
  const [, alta, baixa, tipo] = partes as unknown as [string, string, string, string | undefined]
  const par = alta === baixa
  if (par === (tipo !== undefined)) return problema('hand', `"${hand}" não é uma classe de mão`)
  if (!par && RANKS.indexOf(alta) > RANKS.indexOf(baixa)) return problema('hand', `"${hand}" não é uma classe de mão`)
  const [a, b] = cards as [{ rank: string; suit: string }, { rank: string; suit: string }]
  if (a.rank !== alta || b.rank !== baixa) return problema('cards', `as cartas não combinam com a mão ${hand}`)
  const mesmoNaipe = a.suit === b.suit
  if (tipo === 's' ? !mesmoNaipe : mesmoNaipe) return problema('cards', `os naipes não combinam com a mão ${hand}`)
  return null
}

/** O primeiro problema de um registro, ou `null` se ele é válido e coerente. */
export function problemaDoRegistro(valor: unknown): ProblemaDoRegistro | null {
  if (!ehObjeto(valor)) return problema('registro', 'não é um objeto')
  const r = valor
  if (!textoNaoVazio(r.sessionId)) return problema('sessionId', 'deve ser um texto não vazio')
  if (typeof r.answeredAt !== 'string' || !Number.isFinite(Date.parse(r.answeredAt))) {
    return problema('answeredAt', 'deve ser uma data e hora válidas')
  }
  if (!textoNaoVazio(r.spotId)) return problema('spotId', 'deve ser um texto não vazio')
  if (!FAMILIAS.includes(r.family as string)) return problema('family', 'família desconhecida')
  if (!POSICOES.includes(r.hero as string)) return problema('hero', 'posição desconhecida')
  if (!VILOES.includes(r.villainType as string)) return problema('villainType', 'tipo de vilão desconhecido')
  if (typeof r.hand !== 'string') return problema('hand', 'deve ser um texto')
  const cartas = r.cards
  if (
    !Array.isArray(cartas) ||
    cartas.length !== 2 ||
    !cartas.every((c) => ehObjeto(c) && RANKS.includes(String(c.rank)) && String(c.rank).length === 1 && NAIPES.includes(c.suit as string))
  ) {
    return problema('cards', 'deve trazer duas cartas com rank e naipe válidos')
  }
  const daMao = problemaDaMao(r.hand, cartas as { rank: string; suit: string }[])
  if (daMao) return daMao
  if (!ACOES.includes(r.chosenAction as string)) return problema('chosenAction', 'ação escolhida inválida')
  if (!ACOES.includes(r.correctAction as string)) return problema('correctAction', 'ação certa inválida')
  if (typeof r.correct !== 'boolean') return problema('correct', 'deve ser verdadeiro ou falso')
  if (r.ev !== null && !numeroFinito(r.ev)) return problema('ev', 'deve ser um número finito ou nulo')
  if (r.evLeft !== null && (!numeroFinito(r.evLeft) || r.evLeft < 0)) {
    return problema('evLeft', 'deve ser um número finito não negativo ou nulo')
  }
  if (typeof r.edgeHand !== 'boolean') return problema('edgeHand', 'deve ser verdadeiro ou falso')

  // Coerência entre os campos: o que a avaliação do drill nunca produziria é recusado.
  if (r.correct !== (r.chosenAction === r.correctAction)) {
    return problema('correct', 'não bate com a ação escolhida e a ação certa')
  }
  if (r.ev !== null && (r.correctAction === 'fold' || r.villainType !== 'regular')) {
    return problema('ev', 'só existe EV para uma ação que não é fold, contra regular')
  }
  if (r.evLeft !== null && !(r.chosenAction === 'fold' && r.correctAction !== 'fold' && r.evLeft === r.ev)) {
    return problema('evLeft', 'só existe EV deixado num fold errado, e igual ao EV da ação certa')
  }
  if (r.edgeHand && (r.ev !== null || r.villainType !== 'regular' || r.correctAction === 'fold')) {
    return problema('edgeHand', 'mão de borda é uma mão de ação contra regular sem EV')
  }
  return null
}

function erroDeRegistro(indice: number, p: ProblemaDoRegistro): ResultadoDaLeitura {
  return {
    ok: false,
    erro: { tipo: 'invalido', mensagem: `Registro ${indice + 1}: ${p.campo}: ${p.motivo}.`, registro: indice + 1, campo: p.campo },
  }
}

const invalido = (mensagem: string): ResultadoDaLeitura => ({ ok: false, erro: { tipo: 'invalido', mensagem } })

/**
 * Lê um histórico em texto (do `localStorage` ou de um arquivo). Valida tudo antes de aceitar:
 * devolve os registros ou o primeiro erro, e nunca aceita parte do arquivo.
 */
export function lerHistorico(texto: string, migracoes: Migracoes = MIGRACOES): ResultadoDaLeitura {
  let bruto: unknown
  try {
    bruto = JSON.parse(texto)
  } catch {
    return invalido('O arquivo não é um JSON válido.')
  }
  if (!ehObjeto(bruto) || bruto.app !== APP) return invalido('O arquivo não é um histórico do Trainer Poker.')

  const original = bruto.schemaVersion
  if (typeof original !== 'number' || !Number.isInteger(original) || original < 0) {
    return invalido('A versão do schema do histórico é inválida.')
  }
  if (original > VERSAO_DO_SCHEMA) {
    return {
      ok: false,
      erro: {
        tipo: 'versao-mais-nova',
        versao: original,
        mensagem: `O histórico foi gravado por uma versão mais nova do app (schema ${original}; esta entende até o ${VERSAO_DO_SCHEMA}).`,
      },
    }
  }
  let atual: Record<string, unknown> = bruto
  for (let versao = original; versao < VERSAO_DO_SCHEMA; versao++) {
    const migrar = migracoes[versao]
    if (!migrar) return invalido(`A versão ${versao} do schema do histórico não é suportada.`)
    atual = migrar(atual)
  }
  const respostas = atual.respostas
  if (!Array.isArray(respostas)) return invalido('O histórico não traz a lista de respostas.')
  for (const [i, registro] of respostas.entries()) {
    const p = problemaDoRegistro(registro)
    if (p) return erroDeRegistro(i, p)
  }
  return { ok: true, registros: respostas as RegistroDeResposta[], versao: original }
}
