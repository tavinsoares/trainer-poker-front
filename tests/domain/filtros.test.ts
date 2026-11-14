import { describe, expect, it } from 'vitest'
import type { Position, SpotFamily } from '../../src/data/ranges-types.ts'
import { sortearPergunta } from '../../src/domain/sorteio.ts'
import type { Filtros, Question } from '../../src/domain/tipos.ts'
import { constante, dados, prng } from './auxiliares.ts'

// Seam 1 da spec 2 (o sorteio), olhado pelos filtros: vilão, tipo de spot e posição do Hero.
// Os valores esperados vêm da spec e dos spots reais do ranges.json.

const amostrar = (filtros: Partial<Filtros>, semente = 1, n = 3000): Question[] => {
  const rng = prng(semente)
  return Array.from({ length: n }, () => {
    const p = sortearPergunta(dados, rng, filtros)
    if (!p) throw new Error('o sorteio devolveu "nenhum spot"')
    return p
  })
}
const ids = (perguntas: Question[]) => [...new Set(perguntas.map((p) => p.spot.id))].sort()
const doTipo = (tipo: 'regular' | 'fish') => dados.spots.filter((s) => s.villain.type === tipo)

describe('filtro de vilão', () => {
  it('Regular e Fish restringem o sorteio ao tipo, e o padrão é Ambos (sai os dois)', () => {
    expect(new Set(amostrar({ vilao: 'regular' }).map((p) => p.spot.villain.type))).toEqual(new Set(['regular']))
    expect(new Set(amostrar({ vilao: 'fish' }).map((p) => p.spot.villain.type))).toEqual(new Set(['fish']))
    expect(new Set(amostrar({}).map((p) => p.spot.villain.type))).toEqual(new Set(['regular', 'fish']))
    const semFiltro = sortearPergunta(dados, prng(2))
    expect(semFiltro).not.toBeNull()
  })

  it('em Ambos, rng abaixo de 0,5 escolhe regular e acima escolhe fish', () => {
    expect(sortearPergunta(dados, constante(0.25))!.spot.villain.type).toBe('regular')
    expect(sortearPergunta(dados, constante(0.75))!.spot.villain.type).toBe('fish')
  })

  it('em Ambos, regular e fish têm o mesmo peso mesmo com quantidades diferentes de spots (RFI: 5 contra 2)', () => {
    const perguntas = amostrar({ familias: ['rfi'] }, 3, 20_000)
    const fish = perguntas.filter((p) => p.spot.villain.type === 'fish').length / perguntas.length
    expect(Math.abs(fish - 0.5)).toBeLessThan(0.02) // pela contagem de spots seria 2/7 = 29%
  })

  it('com um dos tipos sem spot depois dos outros filtros, o outro fica com 100%', () => {
    // Não existe RFI do UTG contra fish.
    const utg = amostrar({ familias: ['rfi'], posicoes: ['UTG'] }, 4, 500)
    expect(ids(utg)).toEqual(['rfi-utg-regular'])
  })
})

describe('filtros de tipo de spot e de posição do Hero', () => {
  it('restringem às famílias e às posições do Hero escolhidas, e combinam', () => {
    const familias: SpotFamily[] = ['3bet', 'vs-jam']
    const posicoes: Position[] = ['BTN', 'SB']
    const perguntas = amostrar({ familias, posicoes }, 5, 5000)
    expect(perguntas.filter((p) => !familias.includes(p.spot.family) || !posicoes.includes(p.spot.hero)).map((p) => p.spot.id)).toEqual([])
    // E sai todo spot dessas famílias e posições, contra os dois tipos de vilão.
    const esperados = dados.spots.filter((s) => familias.includes(s.family) && posicoes.includes(s.hero)).map((s) => s.id)
    expect(ids(perguntas)).toEqual(esperados.sort())
  })

  it('defesa do BB contra fish só devolve spots bb-defense do BB contra fish', () => {
    const perguntas = amostrar({ familias: ['bb-defense'], vilao: 'fish' }, 6, 1000)
    expect(ids(perguntas)).toEqual(
      ['bb-defense-bb-vs-btn-fish', 'bb-defense-bb-vs-co-fish', 'bb-defense-bb-vs-hj-fish', 'bb-defense-bb-vs-sb-fish', 'bb-defense-bb-vs-utg-fish'],
    )
  })

  it('o filtro de posição é a do Hero, e não a do vilão', () => {
    const perguntas = amostrar({ posicoes: ['UTG'] }, 7, 3000)
    expect(perguntas.filter((p) => p.spot.hero !== 'UTG').map((p) => p.spot.id)).toEqual([])
    expect(perguntas.filter((p) => p.spot.villain.position === 'UTG').map((p) => p.spot.id)).toEqual([])
  })

  it('conjunto vazio de famílias ou de posições equivale a todos', () => {
    const vazios = amostrar({ familias: [], posicoes: [] }, 8, 40_000)
    expect(ids(vazios)).toEqual(dados.spots.map((s) => s.id).sort())
  })
})

describe('nenhum spot', () => {
  it('devolve null, e não uma pergunta, quando a combinação não tem spot', () => {
    // Não existe RFI do UTG contra fish, nem RFI do BB contra ninguém.
    expect(sortearPergunta(dados, prng(1), { familias: ['rfi'], posicoes: ['UTG'], vilao: 'fish' })).toBeNull()
    expect(sortearPergunta(dados, prng(1), { familias: ['rfi'], posicoes: ['BB'] })).toBeNull()
  })

  it('não lança exceção', () => {
    expect(() => sortearPergunta(dados, constante(0), { familias: ['vs-jam'], posicoes: ['BB'] })).not.toThrow()
  })
})

describe('uniformidade entre os spots do tipo, na ordem do JSON', () => {
  it('com o filtro de vilão Regular, rng 0 e quase 1 escolhem o primeiro e o último spot regular', () => {
    const regulares = doTipo('regular')
    expect(sortearPergunta(dados, constante(0), { vilao: 'regular' })!.spot.id).toBe(regulares[0]!.id)
    expect(sortearPergunta(dados, constante(0.99999), { vilao: 'regular' })!.spot.id).toBe(regulares.at(-1)!.id)
  })

  it('os spots de um tipo saem com a mesma frequência (RFI contra fish: BTN e SB, 50% cada)', () => {
    const perguntas = amostrar({ familias: ['rfi'], vilao: 'fish' }, 9, 10_000)
    const btn = perguntas.filter((p) => p.spot.hero === 'BTN').length / perguntas.length
    expect(Math.abs(btn - 0.5)).toBeLessThan(0.03)
  })
})
