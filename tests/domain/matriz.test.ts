import { describe, expect, it } from 'vitest'
import type { Spot, SpotFamily } from '../../src/data/ranges-types.ts'
import { montarMatriz } from '../../src/domain/matriz.ts'
import { avaliar } from '../../src/domain/avaliacao.ts'
import { dados, perguntaDe } from './auxiliares.ts'

// Spec 3: o modelo da matriz 13×13 de um spot. Único seam: spot (e mão em foco) → modelo.

const RANKS = 'AKQJT98765432'

const spot = (id: string): Spot => {
  const achado = dados.spots.find((s) => s.id === id)
  if (!achado) throw new Error(`o spot ${id} não existe nos dados`)
  return achado
}

describe('a grade 13×13', () => {
  it('tem os literais conhecidos nos cantos e ao lado da diagonal', () => {
    const { cells } = montarMatriz(spot('rfi-utg-regular'))
    const em = (row: number, col: number) => cells[row * 13 + col]!
    expect([em(0, 0).hand, em(0, 1).hand, em(1, 0).hand, em(12, 12).hand, em(0, 12).hand, em(12, 0).hand]).toEqual([
      'AA',
      'AKs',
      'AKo',
      '22',
      'A2s',
      'A2o',
    ])
  })

  it.each(dados.spots.map((s) => [s.id, s] as const))('%s: 169 células, uma por posição, na ordem da grade', (_id, s) => {
    const { cells } = montarMatriz(s)
    expect(cells).toHaveLength(169)
    for (const [i, celula] of cells.entries()) {
      const row = Math.floor(i / 13)
      const col = i % 13
      const esperada =
        row === col
          ? `${RANKS[row]}${RANKS[col]}`
          : col > row
            ? `${RANKS[row]}${RANKS[col]}s`
            : `${RANKS[col]}${RANKS[row]}o`
      expect(`${s.id} ${celula.row},${celula.col} ${celula.hand}`).toBe(`${s.id} ${row},${col} ${esperada}`)
    }
  })

  it('cada célula carrega ação, combos e cor da mão do spot, e fora do range é só o cinza', () => {
    const erros: string[] = []
    for (const s of dados.spots) {
      const porNome = new Map(s.hands.map((h) => [h.hand, h]))
      for (const celula of montarMatriz(s).cells) {
        const mao = porNome.get(celula.hand)
        if (!mao) {
          erros.push(`${s.id} ${celula.hand}: sem mão no spot`)
          continue
        }
        const cor = mao.action === 'out_of_range' ? 'out' : mao.action
        if (celula.action !== mao.action || celula.combos !== mao.combos || celula.color !== cor) {
          erros.push(`${s.id} ${celula.hand}: ${celula.action}/${celula.combos}/${celula.color}, esperado ${mao.action}/${mao.combos}/${cor}`)
        }
      }
    }
    expect(erros).toEqual([])
  })
})

describe('o nome de exibição da ação', () => {
  const rotuloDoRaise: Record<SpotFamily, string | null> = {
    rfi: 'Open',
    '3bet': '3bet',
    'bb-defense': '3bet',
    'vs-3bet': '4bet',
    'vs-4bet': null, // o vs 4bet não tem raise: a agressão do Hero é o jam
    'vs-jam': null,
  }

  it('segue a família: Open, 3bet e 4bet; Jam, Call, Fold e Fora do range têm o próprio nome', () => {
    const erros: string[] = []
    const esperado = (family: SpotFamily, action: string) =>
      action === 'raise' ? rotuloDoRaise[family] : { jam: 'Jam', call: 'Call', fold: 'Fold', out_of_range: 'Fora do range' }[action]
    for (const s of dados.spots) {
      for (const celula of montarMatriz(s).cells) {
        if (celula.label !== esperado(s.family, celula.action)) {
          erros.push(`${s.id} ${celula.hand}: ${celula.action} saiu como "${celula.label}"`)
        }
      }
    }
    expect(erros).toEqual([])
  })

  it('mostra Jam no vs 3bet em que a planilha tem mãos de jam', () => {
    const jam = montarMatriz(spot('vs-3bet-hj-vs-co-regular')).cells.filter((c) => c.action === 'jam')
    expect(jam.map((c) => [c.hand, c.label])).toEqual([
      ['AKo', 'Jam'],
      ['QQ', 'Jam'],
    ])
  })
})

describe('a mão em foco', () => {
  it('marca exatamente uma célula, a certa, e nenhuma sem foco', () => {
    const s = spot('bb-defense-bb-vs-btn-regular')
    expect(montarMatriz(s).cells.filter((c) => c.focused)).toEqual([])
    const focadas = montarMatriz(s, 'A5s').cells.filter((c) => c.focused)
    expect(focadas.map((c) => c.hand)).toEqual(['A5s'])
  })

  it('funciona em mão de fold e em mão fora do range', () => {
    const s = spot('vs-3bet-utg-vs-hj-regular')
    const fold = s.hands.find((h) => h.action === 'fold')!.hand
    const fora = s.hands.find((h) => h.action === 'out_of_range')!.hand
    for (const nome of [fold, fora]) {
      expect(montarMatriz(s, nome).cells.filter((c) => c.focused).map((c) => c.hand)).toEqual([nome])
    }
  })

  it('lança erro citando o spot quando a mão não existe', () => {
    expect(() => montarMatriz(spot('rfi-utg-regular'), 'XYo')).toThrow(/rfi-utg-regular.*XYo/)
  })
})

describe('um spot malformado', () => {
  it('com 168 mãos lança erro citando o spot', () => {
    const s = spot('rfi-utg-regular')
    expect(() => montarMatriz({ ...s, hands: s.hands.slice(1) })).toThrow(/rfi-utg-regular/)
  })

  it('com uma mão repetida no lugar de outra lança erro citando o spot e a mão que falta', () => {
    const s = spot('rfi-utg-regular')
    const hands = s.hands.map((h, i) => (i === 5 ? s.hands[4]! : h))
    expect(() => montarMatriz({ ...s, hands })).toThrow(new RegExp(`rfi-utg-regular.*${s.hands[5]!.hand}`))
  })
})

describe('o EV e a mão de borda da célula', () => {
  const celula = (id: string, mao: string) => {
    const achada = montarMatriz(spot(id)).cells.find((c) => c.hand === mao)
    if (!achada) throw new Error(`${id}: sem célula ${mao}`)
    return achada
  }

  it('mão de ação contra regular com EV mostra o EV do JSON', () => {
    const aa = celula('rfi-utg-regular', 'AA')
    expect([aa.ev, aa.edgeHand]).toEqual([10.32, false])
  })

  it('mão de ação contra regular sem EV é mão de borda e não tem EV', () => {
    const a2s = celula('rfi-utg-regular', 'A2s')
    expect([a2s.ev, a2s.edgeHand]).toEqual([null, true])
  })

  it('fold nunca expõe EV, nem o 4,03bb do AJo no vs 4bet do BB contra o SB', () => {
    const ajo = celula('vs-4bet-bb-vs-sb-regular', 'AJo')
    expect([ajo.action, ajo.ev, ajo.edgeHand]).toEqual(['fold', null, false])
  })

  it('nenhuma célula de fold ou fora do range tem EV ou marca de borda, e nenhuma de fish tem EV', () => {
    const erros: string[] = []
    for (const s of dados.spots) {
      for (const c of montarMatriz(s).cells) {
        if ((c.action === 'fold' || c.action === 'out_of_range') && (c.ev !== null || c.edgeHand)) {
          erros.push(`${s.id} ${c.hand}: ${c.action} com ev=${c.ev} borda=${c.edgeHand}`)
        }
        if (s.villain.type === 'fish' && (c.ev !== null || c.edgeHand)) {
          erros.push(`${s.id} ${c.hand}: fish com ev=${c.ev} borda=${c.edgeHand}`)
        }
      }
    }
    expect(erros).toEqual([])
  })

  it('o EV de toda mão de ação contra regular é o do JSON', () => {
    const erros: string[] = []
    for (const s of dados.spots.filter((x) => x.villain.type === 'regular')) {
      const porNome = new Map(s.hands.map((h) => [h.hand, h]))
      for (const c of montarMatriz(s).cells) {
        const mao = porNome.get(c.hand)!
        if (['call', 'raise', 'jam'].includes(c.action) && c.ev !== mao.ev) {
          erros.push(`${s.id} ${c.hand}: ev ${c.ev}, esperado ${mao.ev}`)
        }
      }
    }
    expect(erros).toEqual([])
  })

  it('coincide com o veredito da avaliação (spec 2) em toda mão que chega ao spot', () => {
    const erros: string[] = []
    for (const s of dados.spots) {
      for (const c of montarMatriz(s).cells.filter((x) => x.action !== 'out_of_range')) {
        const veredito = avaliar(dados, perguntaDe(s.id, c.hand), 'fold')
        if (veredito.ev !== c.ev || veredito.edgeHand !== c.edgeHand) {
          erros.push(`${s.id} ${c.hand}: célula ev=${c.ev} borda=${c.edgeHand}, veredito ev=${veredito.ev} borda=${veredito.edgeHand}`)
        }
      }
    }
    expect(erros).toEqual([])
  })
})

describe('a legenda', () => {
  const acoesDasCelulas = (s: Spot) => new Set(montarMatriz(s).cells.map((c) => c.action))

  it('tem uma entrada por ação que existe nas células, e Fora do range se e só se há mãos cinza', () => {
    const erros: string[] = []
    for (const s of dados.spots) {
      const esperadas = acoesDasCelulas(s)
      const { legend } = montarMatriz(s)
      const naLegenda = legend.map((e) => e.action)
      if (new Set(naLegenda).size !== naLegenda.length || [...esperadas].sort().join() !== [...naLegenda].sort().join()) {
        erros.push(`${s.id}: legenda ${naLegenda.join(',')}, células ${[...esperadas].join(',')}`)
      }
      if (esperadas.has('out_of_range') && naLegenda.at(-1) !== 'out_of_range') erros.push(`${s.id}: Fora do range não é a última`)
    }
    expect(erros).toEqual([])
  })

  it('segue a ordem da legenda da planilha e usa o nome de exibição e o percentual dela', () => {
    const { legend } = montarMatriz(spot('bb-defense-bb-vs-btn-regular'))
    expect(legend.map((e) => [e.label, e.percent])).toEqual(
      spot('bb-defense-bb-vs-btn-regular').legend.map((e) => [{ raise: '3bet', call: 'Call', fold: 'Fold' }[e.action as string], e.percent]),
    )
  })

  it('o percentual vem sempre da legenda da planilha, nunca da contagem de células', () => {
    const erros: string[] = []
    for (const s of dados.spots) {
      for (const e of montarMatriz(s).legend) {
        const daPlanilha = s.legend.find((l) => l.action === e.action)?.percent ?? null
        if (e.action === 'out_of_range' ? e.percent !== null : e.percent !== daPlanilha) {
          erros.push(`${s.id} ${e.label}: ${e.percent}, planilha ${daPlanilha}`)
        }
      }
    }
    expect(erros).toEqual([])
  })

  it('o jam do vs 3bet HJ contra CO aparece sem percentual, porque a legenda da planilha não o cita', () => {
    const { legend } = montarMatriz(spot('vs-3bet-hj-vs-co-regular'))
    expect(legend.map((e) => [e.label, e.percent])).toEqual([
      ['4bet', 22.4],
      ['Call', 18.5],
      ['Fold', 59.1],
      ['Jam', null],
      ['Fora do range', null],
    ])
  })

  it('o JAM 4,7% do vs 3bet SB contra BB não aparece, porque nenhuma mão é jam', () => {
    const { legend } = montarMatriz(spot('vs-3bet-sb-vs-bb-regular'))
    expect(legend.map((e) => e.label)).toEqual(['4bet', 'Call', 'Fold', 'Fora do range'])
  })

  it('o FOLD 0% do vs jam de BTN contra BB fish some, porque nenhuma mão é fold', () => {
    const { legend } = montarMatriz(spot('vs-jam-btn-vs-bb-fish'))
    expect(legend.map((e) => [e.label, e.percent])).toEqual([
      ['Call', 100],
      ['Fora do range', null],
    ])
  })
})

describe('o resumo do range', () => {
  // Referências calculadas à parte: combos das mãos que chegam ao spot sobre 1326.
  it.each([
    ['rfi-utg-regular', 100],
    ['vs-3bet-utg-vs-hj-regular', 19.8], // 262 combos
    ['vs-3bet-hj-vs-co-regular', 27.3], // 362
    ['vs-3bet-sb-vs-bb-regular', 50.5], // 670
    ['vs-4bet-bb-vs-sb-regular', 24.0], // 318
    ['vs-jam-btn-vs-bb-fish', 3.3], // 44
  ])('%s: %s% do baralho chega ao spot', (id, esperado) => {
    expect(montarMatriz(spot(id)).summary.deckPercent).toBe(esperado)
  })

  it('é 100% nos spots sem mãos fora do range', () => {
    const erros = dados.spots
      .filter((s) => s.hands.every((h) => h.action !== 'out_of_range'))
      .filter((s) => montarMatriz(s).summary.deckPercent !== 100)
      .map((s) => s.id)
    expect(erros).toEqual([])
  })

  it('traz o percentual por ação da legenda da planilha, sobre as mãos que chegam ao spot', () => {
    expect(montarMatriz(spot('vs-3bet-utg-vs-hj-regular')).summary.percents).toEqual({ raise: 20.8, call: 20.8, fold: 58.4 })
  })
})
