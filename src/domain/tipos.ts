// Tipos do domínio de spots (spec 2). Puro TypeScript: sem Vue, sem Pinia.

import type { Action, Spot } from '../data/ranges-types.ts'

/** Ação que o aluno pode escolher: as canônicas, menos "fora do range", que nunca é pergunta. */
export type AnswerableAction = Exclude<Action, 'out_of_range'>

/** Fonte de aleatoriedade injetada: devolve um número de 0 (inclusive) a 1 (exclusive). */
export type Rng = () => number

/** Naipes: espadas, copas, ouros e paus. */
export type Suit = 's' | 'h' | 'd' | 'c'

export interface Card {
  rank: string
  suit: Suit
}

/** Botão oferecido ao aluno: a ação canônica e o nome de exibição. */
export interface ActionOption {
  action: AnswerableAction
  label: string
}

/** Resultado da avaliação de uma resposta: pontuação binária, sem limiares. */
export interface Verdict {
  correct: boolean
  correctAction: AnswerableAction
  chosenAction: AnswerableAction
}

export interface Question {
  spot: Pick<Spot, 'id' | 'family' | 'hero' | 'villain'>
  hand: {
    /** Nome canônico da classe: `AA`, `AKs`, `AKo`... */
    name: string
    /** As duas cartas, a mais alta primeiro. */
    cards: [Card, Card]
  }
  /** Pote em bb quando o Hero decide. */
  pot: number
  options: ActionOption[]
}
