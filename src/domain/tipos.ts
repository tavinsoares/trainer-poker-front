// Tipos do domínio de spots (spec 2). Puro TypeScript: sem Vue, sem Pinia.

import type { Action, Position, Spot, SpotFamily, VillainType } from '../data/ranges-types.ts'

/** Ação que o aluno pode escolher: as canônicas, menos "fora do range", que nunca é pergunta. */
export type AnswerableAction = Exclude<Action, 'out_of_range'>

/** Fonte de aleatoriedade injetada: devolve um número de 0 (inclusive) a 1 (exclusive). */
export type Rng = () => number

/**
 * Filtros do sorteio. Vilão: Regular, Fish ou Ambos (padrão). Tipo de spot e posição do Hero:
 * conjuntos, e conjunto vazio significa "todos".
 */
export interface Filtros {
  vilao: VillainType | 'ambos'
  familias: SpotFamily[]
  posicoes: Position[]
}

/** Naipes: espadas, copas, ouros e paus. */
export type Suit = 's' | 'h' | 'd' | 'c'

export interface Card {
  rank: string
  suit: Suit
}

/** Botão oferecido ao aluno: a ação canônica, o nome de exibição e, em raise e jam, o tamanho em bb. */
export interface ActionOption {
  action: AnswerableAction
  label: string
  size?: number
  /** O tamanho não vem da planilha para este vilão: foi emprestado do spot equivalente contra regular. */
  estimated?: boolean
}

/** Jogadas de apostas que aparecem na mesa. */
export type BetAction = 'open' | '3bet' | '4bet' | 'jam'

/** Uma aposta feita antes da decisão do Hero, com o total em bb (já contando o blind do SB e do BB). */
export interface Bet {
  position: Position
  action: BetAction
  size: number
  estimated: boolean
}

/**
 * Um dos seis assentos: o Hero, quem já foldou, quem agiu (com a última aposta) ou quem ainda
 * não agiu (nas famílias em que a primeira decisão é do Hero).
 */
export interface Seat {
  position: Position
  state: 'hero' | 'folded' | 'acted' | 'waiting'
  action?: BetAction
  size?: number
  estimated?: boolean
}

/** Resultado da avaliação de uma resposta: pontuação binária, sem limiares. */
export interface Verdict {
  correct: boolean
  correctAction: AnswerableAction
  chosenAction: AnswerableAction
  /**
   * EV da ação certa em bb, quando ela não é fold e a planilha traz o número. O fold vale zero
   * por definição, então o EV que a planilha escreve numa mão de fold não é usado.
   */
  ev: number | null
  /** EV deixado na mesa: fold errado numa mão de ação com EV positivo, contra regular. Igual a `ev`. */
  evLeft: number | null
  /**
   * Mão de borda: contra regular, mão de ação sem EV na planilha (frequência provavelmente mista).
   * A pontuação não muda por isso.
   */
  edgeHand: boolean
  villainType: VillainType
}

export interface Question {
  spot: Pick<Spot, 'id' | 'family' | 'hero' | 'villain'>
  hand: {
    /** Nome canônico da classe: `AA`, `AKs`, `AKo`... */
    name: string
    /** As duas cartas, a mais alta primeiro. */
    cards: [Card, Card]
  }
  /** Stack efetivo, em bb. */
  stack: number
  /** Pote em bb quando o Hero decide, contando os blinds. */
  pot: number
  /** Quanto o Hero paga para continuar, em bb. `null` no RFI, em que não há aposta a enfrentar. */
  toCall: number | null
  /** As apostas feitas até a vez do Hero, em ordem (inclusive as do próprio Hero). */
  history: Bet[]
  /** Os seis assentos, de UTG a BB. */
  seats: Seat[]
  options: ActionOption[]
}
