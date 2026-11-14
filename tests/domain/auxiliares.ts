import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { RangesData } from '../../src/data/ranges-types.ts'
import { sortearPergunta } from '../../src/domain/sorteio.ts'
import type { Filtros, Question } from '../../src/domain/tipos.ts'

// Ajudantes das suítes do domínio (spec 2). O JSON real é a base de todos os testes.
export const dados: RangesData = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '..', '..', 'data', 'ranges.json'), 'utf-8'),
)

export const constante = (valor: number) => () => valor

// PRNG determinístico (mulberry32): amostras grandes sem teste instável.
export const prng = (semente: number) => () => {
  semente = (semente + 0x6d2b79f5) | 0
  let t = Math.imul(semente ^ (semente >>> 15), 1 | semente)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** O sorteio sem o caso "nenhum spot", para os testes em que sempre há spot. */
export const sortear = (base: RangesData, rng: () => number, filtros: Partial<Filtros> = {}): Question => {
  const pergunta = sortearPergunta(base, rng, filtros)
  if (!pergunta) throw new Error('o sorteio devolveu "nenhum spot"')
  return pergunta
}

export const amostra = (n: number, semente: number, base: RangesData = dados) => {
  const rng = prng(semente)
  return Array.from({ length: n }, () => sortear(base, rng))
}

/**
 * A pergunta de um spot e uma mão específicos, forçada com um rng roteirizado: a primeira chamada
 * escolhe o spot (o primeiro da lista restrita) e a segunda, a combinação (a primeira da mão, na
 * ordem da matriz, entre as combinações das mãos que chegam ao spot). A lista restrita traz
 * também o spot equivalente contra regular, que o sorteio usa para os tamanhos que faltam.
 */
export const perguntaDe = (spotId: string, mao: string, base: RangesData = dados): Question => {
  const spot = base.spots.find((s) => s.id === spotId)
  if (!spot) throw new Error(`o spot ${spotId} não existe nos dados`)
  const contraparte = base.spots.find((s) => s.id === spotId.replace(/-fish$/, '-regular') && s !== spot)
  const sorteaveis = spot.hands.filter((h) => h.action !== 'out_of_range')
  const total = sorteaveis.reduce((soma, h) => soma + h.combos, 0)
  const antes = sorteaveis.slice(0, sorteaveis.findIndex((h) => h.hand === mao)).reduce((soma, h) => soma + h.combos, 0)
  if (!sorteaveis.some((h) => h.hand === mao)) throw new Error(`${spotId}: a mão ${mao} não é sorteável`)
  const roteiro = [0, (antes + 0.5) / total]
  let chamada = 0
  const rng = () => roteiro[Math.min(chamada++, roteiro.length - 1)]!
  return sortear({ ...base, spots: [spot, ...(contraparte ? [contraparte] : [])] }, rng, { vilao: spot.villain.type })
}
