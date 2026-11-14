import type { Hand, RangesData, Spot, VillainType } from '../data/ranges-types.ts'
import { montarCena } from './cena.ts'
import type { Card, Filtros, Question, Rng, Suit } from './tipos.ts'

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

/**
 * Escolhe o spot entre os que passam nos filtros. Em Ambos, regular e fish têm o mesmo peso:
 * sorteia-se o tipo (50% cada, entre os tipos que ainda têm spot) e depois um spot uniforme dentro
 * do tipo. Sem nenhum spot, devolve `undefined`.
 */
function escolherSpot(dados: RangesData, rng: Rng, { vilao = 'ambos', familias = [], posicoes = [] }: Partial<Filtros>) {
  const candidatos = dados.spots.filter(
    (s) => (familias.length === 0 || familias.includes(s.family)) && (posicoes.length === 0 || posicoes.includes(s.hero)),
  )
  const tipos: VillainType[] = (['regular', 'fish'] as const).filter(
    (t) => (vilao === 'ambos' || vilao === t) && candidatos.some((s) => s.villain.type === t),
  )
  if (tipos.length === 0) return undefined
  const tipo = tipos.length === 1 ? tipos[0]! : tipos[Math.floor(rng() * tipos.length)]!
  const doTipo: Spot[] = candidatos.filter((s) => s.villain.type === tipo)
  return doTipo[Math.floor(rng() * doTipo.length)]
}

/** Sorteia uma pergunta, ou devolve `null` quando nenhum spot passa nos filtros. */
export function sortearPergunta(dados: RangesData, rng: Rng, filtros: Partial<Filtros> = {}): Question | null {
  const spot = escolherSpot(dados, rng, filtros)
  if (!spot) return null

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
