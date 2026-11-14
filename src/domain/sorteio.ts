import type { Hand, RangesData } from '../data/ranges-types.ts'
import { montarCena } from './cena.ts'
import type { Card, Question, Rng, Suit } from './tipos.ts'

const NAIPES: Suit[] = ['s', 'h', 'd', 'c']

type TipoDaMao = 'par' | 'suited' | 'offsuit'

const tipoDaMao = (nome: string): TipoDaMao =>
  nome.length === 2 ? 'par' : nome.endsWith('s') ? 'suited' : 'offsuit'

/**
 * As combinações de naipes de uma classe de mão, numa ordem fixa. Par: dois naipes distintos
 * (6). Suited: um naipe para as duas cartas (4). Offsuit: o naipe da carta mais alta e o da
 * mais baixa, distintos (12).
 */
function combinacoesDeNaipes(nome: string): [Suit, Suit][] {
  const tipo = tipoDaMao(nome)
  if (tipo === 'suited') return NAIPES.map((n) => [n, n])
  const combinacoes: [Suit, Suit][] = []
  for (const [i, alta] of NAIPES.entries()) {
    for (const [j, baixa] of NAIPES.entries()) {
      if (tipo === 'par' ? i < j : i !== j) combinacoes.push([alta, baixa])
    }
  }
  return combinacoes
}

/**
 * Escolhe uma combinação uniforme entre todas as das mãos sorteáveis: a mão sai do peso em
 * combos, e a posição dentro da mão escolhe os naipes.
 */
function escolherCombinacao(maos: Hand[], rng: Rng): { mao: Hand; indice: number } {
  let indice = Math.floor(rng() * maos.reduce((soma, h) => soma + h.combos, 0))
  for (const mao of maos) {
    if (indice < mao.combos) return { mao, indice }
    indice -= mao.combos
  }
  throw new Error('o spot não tem mãos sorteáveis')
}

export function sortearPergunta(dados: RangesData, rng: Rng): Question {
  const spot = dados.spots[Math.floor(rng() * dados.spots.length)]
  if (!spot) throw new Error('não há spot para sortear')

  // As mãos fora do range nunca entram.
  const { mao, indice } = escolherCombinacao(
    spot.hands.filter((h) => h.action !== 'out_of_range'),
    rng,
  )
  const naipes = combinacoesDeNaipes(mao.hand)[indice]
  if (!naipes) throw new Error(`a mão ${mao.hand} não tem a combinação ${indice} (tem ${mao.combos})`)
  const cartas: [Card, Card] = [
    { rank: mao.hand.charAt(0), suit: naipes[0] },
    { rank: mao.hand.charAt(1), suit: naipes[1] },
  ]

  return {
    spot: { id: spot.id, family: spot.family, hero: spot.hero, villain: spot.villain },
    hand: { name: mao.hand, cards: cartas },
    ...montarCena(dados, spot),
  }
}
