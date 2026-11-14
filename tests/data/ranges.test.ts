import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Position, RangesData } from '../../src/data/ranges-types.ts'

// Seam único desta spec: o JSON gerado pelo conversor. O conversor é uma
// caixa-preta; aqui só se confere o que o app vai consumir.
const dados: RangesData = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '..', '..', 'data', 'ranges.json'), 'utf-8'),
)

const POSICOES: Position[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']
const ACOES = ['fold', 'call', 'raise', 'jam', 'out_of_range']

// Mãos canônicas na ordem da matriz: A, K, Q... 2, linha por linha, com pares na
// diagonal, suited acima (AKs) e offsuit abaixo (AKo).
const RANKS = 'AKQJT98765432'
const MAOS_NA_ORDEM = RANKS.split('').flatMap((linha, i) =>
  RANKS.split('').map((coluna, j) => {
    if (i === j) return linha + coluna
    return i < j ? `${linha}${coluna}s` : `${coluna}${linha}o`
  }),
)
const COMBOS = (mao: string) => (mao.length === 2 ? 6 : mao.endsWith('s') ? 4 : 12)

const spotPorHero = (hero: Position) => {
  const spot = dados.spots.find((s) => s.hero === hero)
  if (!spot) throw new Error(`spot de RFI do ${hero} não existe`)
  return spot
}
const mao = (hero: Position, nome: string) => {
  const encontrada = spotPorHero(hero).hands.find((h) => h.hand === nome)
  if (!encontrada) throw new Error(`mão ${nome} não existe no spot ${spotPorHero(hero).id}`)
  return encontrada
}

describe('procedência', () => {
  it('registra fonte, data de importação, versão do schema e hash da planilha', () => {
    const { manifest } = dados
    expect(manifest.source).toBe('Metagame · Ranges Simplificados')
    expect(manifest.importedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(manifest.schemaVersion).toBe(1)
    expect(manifest.sourceSha256).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('RFI contra regular', () => {
  it('tem os cinco spots, um por posição que abre, sem duplicatas', () => {
    const rfi = dados.spots.filter((s) => s.family === 'rfi' && s.villain.type === 'regular')
    expect(rfi.map((s) => s.hero)).toEqual(['UTG', 'HJ', 'CO', 'BTN', 'SB'])
    expect(new Set(dados.spots.map((s) => s.id)).size).toBe(dados.spots.length)
  })

  it('traz a aba de origem, e o MP da planilha aparece como HJ', () => {
    const porHero = Object.fromEntries(dados.spots.map((s) => [s.hero, s.sourceSheet]))
    expect(porHero).toEqual({
      UTG: 'RFI UTG',
      HJ: 'RFI MP',
      CO: 'RFI CO',
      BTN: 'RFI BTN',
      SB: 'RFI SB',
    })
  })

  it('só usa as seis posições da v1, sem MP', () => {
    const usadas = dados.spots.flatMap((s) => [s.hero, s.villain.position]).filter((p) => p !== null)
    expect(usadas.filter((p) => !POSICOES.includes(p as Position))).toEqual([])
  })

  it('não tem posição de vilão no RFI', () => {
    expect(dados.spots.map((s) => s.villain.position)).toEqual([null, null, null, null, null])
  })
})

describe('mãos de cada spot', () => {
  it('tem exatamente as 169 mãos canônicas, na ordem da matriz, sem faltas nem repetições', () => {
    const violacoes = dados.spots
      .filter((s) => s.hands.map((h) => h.hand).join() !== MAOS_NA_ORDEM.join())
      .map((s) => `${s.id}: mãos diferentes das 169 canônicas (tem ${s.hands.length})`)
    expect(violacoes).toEqual([])
  })

  it('dá a cada mão uma ação do vocabulário fechado e o número certo de combos', () => {
    const violacoes = dados.spots.flatMap((s) =>
      s.hands.flatMap((h) => [
        ...(ACOES.includes(h.action) ? [] : [`${s.id}: mão ${h.hand} tem ação inválida "${h.action}"`]),
        ...(h.combos === COMBOS(h.hand) ? [] : [`${s.id}: mão ${h.hand} tem ${h.combos} combos`]),
      ]),
    )
    expect(violacoes).toEqual([])
  })

  // Valores conferidos à mão na planilha (aba RFI UTG).
  it('lê a ação certa pela cor da célula: AA e A2s abrem, K8s é fold no UTG', () => {
    expect(mao('UTG', 'AA')).toMatchObject({ action: 'raise', label: 'RFI' })
    expect(mao('UTG', 'A2s')).toMatchObject({ action: 'raise', label: 'RFI' })
    expect(mao('UTG', 'K8s')).toMatchObject({ action: 'fold', label: 'FOLD' })
  })

  // Contagem de mãos salmão (RFI) de cada aba, contada à mão na planilha.
  it.each([
    ['UTG', 47],
    ['HJ', 55],
    ['CO', 68],
    ['BTN', 103],
    ['SB', 103],
  ] as const)('o RFI do %s abre %i mãos', (hero, esperado) => {
    expect(spotPorHero(hero).hands.filter((h) => h.action === 'raise')).toHaveLength(esperado)
  })
})

// Arredondamento da legenda: a planilha escreve o percentual com uma casa decimal.
const TOLERANCIA_PP = 0.1
const TOTAL_COMBOS = 1326

const percentual = (combos: number) => (100 * combos) / TOTAL_COMBOS
const combosDe = (spot: (typeof dados.spots)[number], filtro: (h: (typeof dados.spots)[number]['hands'][number]) => boolean) =>
  spot.hands.filter(filtro).reduce((soma, h) => soma + h.combos, 0)

describe('legenda', () => {
  // Percentuais lidos à mão na legenda de cada aba.
  it.each([
    ['UTG', 19.5, 80.5],
    ['HJ', 23.4, 76.6],
    ['CO', 29.7, 70.3],
    ['BTN', 42.5, 57.5],
    ['SB', 43.4, 56.6],
  ] as const)('a legenda do RFI do %s diz RFI %f%% e FOLD %f%%', (hero, rfi, fold) => {
    expect(spotPorHero(hero).legend).toEqual([
      { label: 'RFI', action: 'raise', percent: rfi },
      { label: 'FOLD', action: 'fold', percent: fold },
    ])
  })

  it('só tem ações que aparecem nas mãos, e toda ação das mãos aparece na legenda', () => {
    const violacoes = dados.spots.flatMap((s) => {
      const nasMaos = new Set(s.hands.map((h) => h.action))
      const naLegenda = new Set(s.legend.map((l) => l.action))
      return [...new Set([...nasMaos, ...naLegenda])]
        .filter((a) => nasMaos.has(a) !== naLegenda.has(a))
        .map((a) => `${s.id}: a ação "${a}" não está nos dois lados (mãos e legenda)`)
    })
    expect(violacoes).toEqual([])
  })

  it('soma 100% por spot, dentro do arredondamento', () => {
    const violacoes = dados.spots
      .map((s) => ({ id: s.id, soma: s.legend.reduce((t, l) => t + l.percent, 0) }))
      .filter(({ soma }) => Math.abs(soma - 100) > TOLERANCIA_PP)
      .map(({ id, soma }) => `${id}: a legenda soma ${soma}%`)
    expect(violacoes).toEqual([])
  })

  // A legenda não é reproduzível só pelas cores: mãos de borda (coloridas, sem EV)
  // são ações parciais. O percentual fica entre "só as mãos com EV" e "todas as mãos".
  it('tem, para cada ação agressiva, um percentual coerente com a contagem de mãos', () => {
    const violacoes = dados.spots.flatMap((s) =>
      s.legend
        .filter((l) => l.action !== 'fold')
        .flatMap((l) => {
          const todas = percentual(combosDe(s, (h) => h.action === l.action))
          const comEv = percentual(combosDe(s, (h) => h.action === l.action && h.ev !== null))
          const dentro = l.percent >= comEv - TOLERANCIA_PP && l.percent <= todas + TOLERANCIA_PP
          return dentro
            ? []
            : [`${s.id}: ${l.label} diz ${l.percent}%, mas as mãos dão entre ${comEv.toFixed(2)}% e ${todas.toFixed(2)}%`]
        }),
    )
    expect(violacoes).toEqual([])
  })
})

describe('EV', () => {
  // Conferidos à mão na planilha.
  it('lê o EV em bb das mãos de ação e deixa ausente nas mãos de borda', () => {
    expect(mao('UTG', 'AA').ev).toBe(10.32)
    expect(mao('UTG', 'A2s')).toMatchObject({ action: 'raise', ev: null })
    expect(mao('UTG', 'K8s')).toMatchObject({ action: 'fold', ev: null })
  })

  it('só tem EV como número finito', () => {
    const violacoes = dados.spots.flatMap((s) =>
      s.hands
        .filter((h) => h.ev !== null && !Number.isFinite(h.ev))
        .map((h) => `${s.id}: mão ${h.hand} tem EV inválido (${String(h.ev)})`),
    )
    expect(violacoes).toEqual([])
  })

  // Quantidade de mãos de ação com EV em cada aba, contada à mão na planilha.
  it.each([
    ['UTG', 36],
    ['HJ', 47],
    ['CO', 61],
    ['BTN', 84],
    ['SB', 87],
  ] as const)('o RFI do %s tem EV em %i mãos de ação', (hero, esperado) => {
    expect(spotPorHero(hero).hands.filter((h) => h.action === 'raise' && h.ev !== null)).toHaveLength(esperado)
  })

  // A planilha tem EV em duas células de fold (A9o no HJ, com 0, e K3s no CO, com 0.02).
  it('preserva o EV que a planilha traz em mãos de fold, e só nessas duas', () => {
    const emFold = dados.spots.flatMap((s) =>
      s.hands.filter((h) => h.action === 'fold' && h.ev !== null).map((h) => `${s.hero} ${h.hand} ${h.ev}`),
    )
    expect(emFold).toEqual(['HJ A9o 0', 'CO K3s 0.02'])
  })
})

describe('sizings', () => {
  // Lidos à mão nas formas da barra lateral de cada aba (coluna do vilão regular).
  // Valores da coluna do fish (por exemplo "vs RFI UTG 2.5bb" no HJ) não entram aqui.
  it.each([
    ['UTG', 2, { HJ: 6.5, CO: 6.5, BTN: 7.5, SB: 10, BB: 12 }, {}],
    ['HJ', 2, { CO: 6.5, BTN: 7.5, SB: 11, BB: 12.3 }, { UTG: 2 }],
    ['CO', 2.3, { BTN: 7.5, SB: 11.5, BB: 13.5 }, { UTG: 2, HJ: 2 }],
    ['BTN', 2.5, { SB: 12, BB: 13 }, { UTG: 2, HJ: 2, CO: 2.3 }],
    ['SB', 3, { BB: 10 }, { UTG: 2, HJ: 2, CO: 2.3, BTN: 2.5 }],
  ] as const)('o RFI do %s abre para %fbb, com os 3bets e opens enfrentados da aba', (hero, open, vs3bet, vsOpen) => {
    expect(spotPorHero(hero).sizings).toEqual({ open, vs3bet, vsOpen })
  })

  it('é coerente entre abas: o open que uma posição enfrenta é o RFI dela', () => {
    const abertura = Object.fromEntries(dados.spots.map((s) => [s.hero, s.sizings.open]))
    const violacoes = dados.spots.flatMap((s) =>
      Object.entries(s.sizings.vsOpen)
        .filter(([posicao, tamanho]) => abertura[posicao] !== tamanho)
        .map(([posicao, tamanho]) => `${s.id}: enfrenta open de ${posicao} a ${tamanho}bb, mas o RFI do ${posicao} é ${abertura[posicao]}bb`),
    )
    expect(violacoes).toEqual([])
  })

  it('só usa posições da v1, sem MP', () => {
    const chaves = dados.spots.flatMap((s) => [...Object.keys(s.sizings.vs3bet), ...Object.keys(s.sizings.vsOpen)])
    expect(chaves.filter((p) => !POSICOES.includes(p as Position))).toEqual([])
  })
})
