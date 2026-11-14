import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Action, Hand, Position, RangesData, Spot, SpotFamily } from '../../src/data/ranges-types.ts'

// Seam único desta spec: o JSON gerado pelo conversor. O conversor é uma
// caixa-preta; aqui só se confere o que o app vai consumir.
const dados: RangesData = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '..', '..', 'data', 'ranges.json'), 'utf-8'),
)

const POSICOES: Position[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']
const ACOES: Action[] = ['fold', 'call', 'raise', 'jam', 'out_of_range']

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

const rfiContraRegular = dados.spots.filter((s) => s.family === 'rfi' && s.villain.type === 'regular')

const spotPorHero = (hero: Position) => {
  const spot = rfiContraRegular.find((s) => s.hero === hero)
  if (!spot) throw new Error(`spot de RFI contra regular do ${hero} não existe`)
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

describe('estrutura do JSON', () => {
  it('dá a cada spot um identificador único', () => {
    const repetidos = dados.spots.map((s) => s.id).filter((id, i, todos) => todos.indexOf(id) !== i)
    expect(repetidos).toEqual([])
  })

  it('traz todas as chaves de cada spot, legenda e mão, com o tipo certo', () => {
    const violacoes: string[] = []
    const confere = (onde: string, objeto: object, esperado: Record<string, string>) => {
      for (const [chave, tipo] of Object.entries(esperado)) {
        const valor = (objeto as Record<string, unknown>)[chave]
        const real = valor === null ? 'null' : Array.isArray(valor) ? 'array' : typeof valor
        if (!(chave in objeto) || !tipo.split('|').includes(real)) {
          violacoes.push(`${onde}: a chave "${chave}" deveria ser ${tipo}, mas é ${chave in objeto ? real : 'ausente'}`)
        }
      }
    }
    for (const s of dados.spots) {
      confere(s.id, s, {
        id: 'string', family: 'string', hero: 'string', villain: 'object', sourceSheet: 'string',
        sizings: 'object', legend: 'array', hands: 'array',
      })
      confere(`${s.id} (vilão)`, s.villain, { type: 'string', position: 'string|null' })
      confere(`${s.id} (sizings)`, s.sizings, { vs3bet: 'object', vsOpen: 'object' })
      s.legend.forEach((l, i) => confere(`${s.id} (legenda ${i})`, l, { label: 'string', action: 'string', percent: 'number' }))
      s.hands.forEach((h) => confere(`${s.id} (mão ${h.hand})`, h, { hand: 'string', action: 'string', label: 'string', combos: 'number', ev: 'number|null' }))
    }
    expect(violacoes).toEqual([])
  })
})

describe('RFI contra regular', () => {
  it('tem os cinco spots, um por posição que abre', () => {
    expect(rfiContraRegular.map((s) => s.hero)).toEqual(['UTG', 'HJ', 'CO', 'BTN', 'SB'])
  })

  it('traz a aba de origem, e o MP da planilha aparece como HJ', () => {
    const porHero = Object.fromEntries(rfiContraRegular.map((s) => [s.hero, s.sourceSheet]))
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
    expect(rfiContraRegular.map((s) => s.villain.position)).toEqual([null, null, null, null, null])
  })
})

describe('mãos de cada spot', () => {
  it('tem exatamente as 169 mãos canônicas, na ordem da matriz, sem faltas nem repetições', () => {
    const violacoes = dados.spots.flatMap((s) => {
      const nomes = s.hands.map((h) => h.hand)
      const faltam = MAOS_NA_ORDEM.filter((m) => !nomes.includes(m))
      const sobram = nomes.filter((m, i) => !MAOS_NA_ORDEM.includes(m) || nomes.indexOf(m) !== i)
      const foraDeOrdem = faltam.length === 0 && sobram.length === 0 && nomes.join() !== MAOS_NA_ORDEM.join()
      return [
        ...(faltam.length ? [`${s.id}: faltam as mãos ${faltam.join(', ')}`] : []),
        ...(sobram.length ? [`${s.id}: mãos inválidas ou repetidas: ${sobram.join(', ')}`] : []),
        ...(foraDeOrdem ? [`${s.id}: as 169 mãos estão fora da ordem da matriz`] : []),
      ]
    })
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

  // Mãos conferidas uma a uma direto na planilha (cor da célula e EV), em cada aba.
  // Trocar a ação ou o EV de duas mãos do mesmo spot é pego aqui, e não pelas contagens.
  it.each([
    ['UTG', 'AKs', 'raise', 1.4],
    ['UTG', 'KK', 'raise', 5.61],
    ['UTG', 'T9s', 'raise', 0],
    ['UTG', '72o', 'fold', null],
    ['UTG', '22', 'raise', null],
    ['HJ', 'AKs', 'raise', 1.89],
    ['HJ', 'KK', 'raise', 6.38],
    ['HJ', 'T9s', 'raise', 0.05],
    ['HJ', '72o', 'fold', null],
    ['HJ', '22', 'raise', null],
    ['CO', 'AKs', 'raise', 2.51],
    ['CO', 'KK', 'raise', 7.11],
    ['CO', 'T9s', 'raise', 0.08],
    ['CO', '72o', 'fold', null],
    ['CO', '22', 'raise', null],
    ['BTN', 'AKs', 'raise', 3.18],
    ['BTN', 'KK', 'raise', 7.84],
    ['BTN', 'T9s', 'raise', 0.27],
    ['BTN', '72o', 'fold', null],
    ['BTN', '22', 'raise', 0.01],
    ['SB', 'AKs', 'raise', 2.77],
    ['SB', 'KK', 'raise', 5.71],
    ['SB', 'T9s', 'raise', 0.41],
    ['SB', '72o', 'fold', null],
    ['SB', '22', 'raise', 0.13],
  ] as const)('no RFI do %s, %s é %s com EV %s', (hero, nome, acao, ev) => {
    expect(mao(hero, nome)).toMatchObject({ action: acao, ev })
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

// A planilha escreve o percentual da legenda com uma casa decimal, ou sem nenhuma.
const TOLERANCIA_SOMA_PP = 0.15
// A legenda é um resumo por frequência, e as cores só mostram a ação dominante de cada mão.
// Nas 20 abas tratadas a diferença chega a ~7 pontos (RFI do SB: 43,4% contra 50,5% pelas cores).
// O limite só protege contra ações trocadas (call no lugar de raise difere em 20 pontos ou mais).
const DESVIO_MAXIMO_PP = 8
const TOTAL_COMBOS = 1326

const percentual = (combos: number) => (100 * combos) / TOTAL_COMBOS
const combosDe = (spot: Spot, filtro: (h: Hand) => boolean) =>
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
      .filter(({ soma }) => Math.abs(soma - 100) > TOLERANCIA_SOMA_PP)
      .map(({ id, soma }) => `${id}: a legenda soma ${soma}%`)
    expect(violacoes).toEqual([])
  })

  // A legenda não é reproduzível só pelas cores (ver DESVIO_MAXIMO_PP), então o teste é de
  // ordem de grandeza: cada ação fica perto do que as cores mostram.
  it('tem, para cada ação, um percentual próximo da contagem de mãos da cor', () => {
    const violacoes = dados.spots.flatMap((s) =>
      s.legend.flatMap((l) => {
        const pelasCores = percentual(combosDe(s, (h) => h.action === l.action))
        return Math.abs(l.percent - pelasCores) <= DESVIO_MAXIMO_PP
          ? []
          : [`${s.id}: ${l.label} diz ${l.percent}%, mas as mãos dão ${pelasCores.toFixed(2)}%`]
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
  it('preserva o EV que a planilha traz em mãos de fold no RFI, e só nessas duas', () => {
    const emFold = rfiContraRegular.flatMap((s) =>
      s.hands.filter((h) => h.action === 'fold' && h.ev !== null).map((h) => `${s.hero} ${h.hand} ${h.ev}`),
    )
    expect(emFold).toEqual(['HJ A9o 0', 'CO K3s 0.02'])
  })

  // Fold vale 0 por definição: um EV escrito numa mão de fold só pode ser zero ou arredondamento.
  it('tem EV perto de zero em toda mão de fold que traz EV', () => {
    const violacoes = dados.spots.flatMap((s) =>
      s.hands
        .filter((h) => h.action === 'fold' && h.ev !== null && Math.abs(h.ev) > 0.05)
        .map((h) => `${s.id}: mão ${h.hand} é fold, mas tem EV ${h.ev}`),
    )
    expect(violacoes).toEqual([])
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
    const abertura = Object.fromEntries(rfiContraRegular.map((s) => [s.hero, s.sizings.open]))
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

// ---------------------------------------------------------------------------
// 3bet contra um open e defesa do BB, contra regular (ticket 4).
// Todos os valores abaixo foram lidos direto na planilha, aba por aba.

// [aba, família, Hero, posição de quem abriu]
const SPOTS_DE_RESPOSTA = [
  ['3B HJvUTG', '3bet', 'HJ', 'UTG'],
  ['3B COvUTG', '3bet', 'CO', 'UTG'],
  ['3B BTNvUTG', '3bet', 'BTN', 'UTG'],
  ['3B SBvUTG', '3bet', 'SB', 'UTG'],
  ['BBvUTG', 'bb-defense', 'BB', 'UTG'],
  ['3B COvHJ', '3bet', 'CO', 'HJ'],
  ['3B BTNvHJ', '3bet', 'BTN', 'HJ'],
  ['3B SBvHJ', '3bet', 'SB', 'HJ'],
  ['BBvHJ', 'bb-defense', 'BB', 'HJ'],
  ['3B BTNvCO', '3bet', 'BTN', 'CO'],
  ['3B SBvCO', '3bet', 'SB', 'CO'],
  ['BBvCO', 'bb-defense', 'BB', 'CO'],
  ['3B SBvBTN', '3bet', 'SB', 'BTN'],
  ['BBvBTN', 'bb-defense', 'BB', 'BTN'],
  ['BBvSB', 'bb-defense', 'BB', 'SB'],
] as const

const spotDaAba = (aba: string) => {
  const spot = dados.spots.find((s) => s.sourceSheet === aba)
  if (!spot) throw new Error(`não há spot vindo da aba "${aba}"`)
  return spot
}
const maoDaAba = (aba: string, nome: string) => {
  const encontrada = spotDaAba(aba).hands.find((h) => h.hand === nome)
  if (!encontrada) throw new Error(`mão ${nome} não existe no spot da aba "${aba}"`)
  return encontrada
}
const contaMaos = (aba: string, acao: Action, comEv = false) =>
  spotDaAba(aba).hands.filter((h) => h.action === acao && (!comEv || h.ev !== null)).length

describe('3bet contra um open e defesa do BB: spots', () => {
  it('tem os 10 spots de 3bet e os 5 de defesa do BB contra regular, um por aba', () => {
    const familia = (f: SpotFamily) =>
      dados.spots.filter((s) => s.family === f && s.villain.type === 'regular').map((s) => s.sourceSheet).sort()
    const esperadas = (f: SpotFamily) =>
      SPOTS_DE_RESPOSTA.filter((linha) => linha[1] === f).map((linha) => linha[0]).sort()
    expect(familia('3bet')).toEqual(esperadas('3bet'))
    expect(familia('bb-defense')).toEqual(esperadas('bb-defense'))
  })

  it.each(SPOTS_DE_RESPOSTA)('a aba %s é da família %s, com Hero %s contra o open do %s', (aba, familia, hero, vilao) => {
    const spot = spotDaAba(aba)
    expect(spot).toMatchObject({ family: familia, hero, villain: { type: 'regular', position: vilao } })
    expect(spot.id).toBe(`${familia}-${hero}-vs-${vilao}-regular`.toLowerCase())
  })
})

describe('3bet contra um open e defesa do BB: mãos e legenda', () => {
  // [aba, mãos de 3bet, com EV, mãos de call, com EV, mãos de fold, com EV]. Contadas na planilha.
  it.each([
    ['3B HJvUTG', 23, 16, 0, 0, 146, 0],
    ['3B COvUTG', 21, 17, 0, 0, 148, 0],
    ['3B BTNvUTG', 21, 17, 0, 0, 148, 0],
    ['3B SBvUTG', 21, 13, 0, 0, 148, 0],
    ['BBvUTG', 18, 18, 82, 68, 69, 0],
    ['3B COvHJ', 24, 19, 0, 0, 145, 0],
    ['3B BTNvHJ', 25, 19, 0, 0, 144, 0],
    ['3B SBvHJ', 26, 18, 0, 0, 143, 0],
    ['BBvHJ', 24, 24, 79, 56, 66, 3],
    ['3B BTNvCO', 34, 25, 0, 0, 135, 0],
    ['3B SBvCO', 31, 21, 0, 0, 138, 0],
    ['BBvCO', 29, 29, 68, 60, 72, 14],
    ['3B SBvBTN', 37, 30, 0, 0, 132, 0],
    ['BBvBTN', 39, 39, 60, 58, 70, 12],
    ['BBvSB', 47, 42, 78, 76, 44, 4],
  ] as const)('na aba %s há %i mãos de 3bet (%i com EV), %i de call (%i) e %i de fold (%i)', (aba, r, rEv, c, cEv, f, fEv) => {
    expect([
      contaMaos(aba, 'raise'), contaMaos(aba, 'raise', true),
      contaMaos(aba, 'call'), contaMaos(aba, 'call', true),
      contaMaos(aba, 'fold'), contaMaos(aba, 'fold', true),
    ]).toEqual([r, rEv, c, cEv, f, fEv])
  })

  // Legenda de cada aba, lida à mão: rótulo e percentual de cada cor.
  it.each([
    ['3B HJvUTG', [9, 91]],
    ['3B COvUTG', [9.6, 90.4]],
    ['3B BTNvUTG', [9.8, 90.2]],
    ['3B SBvUTG', [8, 92]],
    ['3B COvHJ', [11.2, 88.8]],
    ['3B BTNvHJ', [11.7, 88.3]],
    ['3B SBvHJ', [9.2, 90.8]],
    ['3B BTNvCO', [14.3, 85.7]],
    ['3B SBvCO', [11.2, 88.8]],
    ['3B SBvBTN', [15.1, 84.9]],
  ] as const)('a legenda da aba %s diz 3BET %f%% e FOLD %f%%', (aba, [tresBet, fold]) => {
    expect(spotDaAba(aba).legend).toEqual([
      { label: '3BET', action: 'raise', percent: tresBet },
      { label: 'FOLD', action: 'fold', percent: fold },
    ])
  })

  it.each([
    ['BBvUTG', [5.5, 39.2, 55.3]],
    ['BBvHJ', [6.8, 41.9, 51.2]],
    ['BBvCO', [8.9, 30.4, 60.7]],
    ['BBvBTN', [14.2, 29.4, 56.4]],
    ['BBvSB', [17.2, 41.3, 41.5]],
  ] as const)('a legenda da aba %s diz 3BET %f%%, CALL %f%% e FOLD %f%%', (aba, [tresBet, call, fold]) => {
    expect(spotDaAba(aba).legend).toEqual([
      { label: '3BET', action: 'raise', percent: tresBet },
      { label: 'CALL', action: 'call', percent: call },
      { label: 'FOLD', action: 'fold', percent: fold },
    ])
  })

  // Cinco mãos por aba, conferidas direto na planilha (ação pela cor e EV).
  const MAOS_CONFERIDAS: Record<string, Record<string, readonly [Action, number | null]>> = {
    '3B HJvUTG': { AA: ['raise', 15.5], A5s: ['raise', 0], '76s': ['fold', null], '72o': ['fold', null], KQo: ['raise', null] },
    '3B COvUTG': { AA: ['raise', 15.71], A5s: ['raise', 0], '76s': ['fold', null], '72o': ['fold', null], KQo: ['raise', null] },
    '3B BTNvUTG': { AA: ['raise', 15.96], A5s: ['raise', null], '76s': ['fold', null], '72o': ['fold', null], KQo: ['raise', 0] },
    '3B SBvUTG': { AA: ['raise', 13.02], A5s: ['raise', null], '76s': ['fold', null], '72o': ['fold', null], KQo: ['fold', null] },
    BBvUTG: { AA: ['raise', 11.53], A5s: ['call', 0.52], '76s': ['raise', 0.28], '72o': ['fold', null], KQo: ['call', 0.47] },
    '3B COvHJ': { AA: ['raise', 16.09], A5s: ['raise', 0.01], '76s': ['fold', null], '72o': ['fold', null], KQo: ['raise', null] },
    '3B BTNvHJ': { AA: ['raise', 16.19], A5s: ['raise', 0], '76s': ['fold', null], '72o': ['fold', null], KQo: ['raise', 0.06] },
    '3B SBvHJ': { AA: ['raise', 13.38], A5s: ['raise', 0], '76s': ['raise', null], '72o': ['fold', null], KQo: ['raise', null] },
    BBvHJ: { AA: ['raise', 11.79], A5s: ['raise', 0.59], '76s': ['raise', 0.29], '72o': ['fold', null], KQo: ['call', 0.64] },
    '3B BTNvCO': { AA: ['raise', 17.47], A5s: ['raise', 0.02], '76s': ['raise', null], '72o': ['fold', null], KQo: ['raise', 0.04] },
    '3B SBvCO': { AA: ['raise', 14.58], A5s: ['raise', 0.06], '76s': ['fold', null], '72o': ['fold', null], KQo: ['raise', 0] },
    BBvCO: { AA: ['raise', 12.98], A5s: ['raise', 0.59], '76s': ['raise', 0.31], '72o': ['fold', null], KQo: ['raise', 0.69] },
    '3B SBvBTN': { AA: ['raise', 15.56], A5s: ['raise', 0.12], '76s': ['raise', null], '72o': ['fold', null], KQo: ['raise', 0.2] },
    BBvBTN: { AA: ['raise', 14.4], A5s: ['raise', 0.76], '76s': ['raise', 0.39], '72o': ['fold', null], KQo: ['raise', 0.99] },
    BBvSB: { AA: ['raise', 16.48], A5s: ['raise', 1.14], '76s': ['raise', 0.6], '72o': ['fold', null], KQo: ['raise', 1.54] },
  }
  const TODAS_AS_MAOS_CONFERIDAS = Object.entries(MAOS_CONFERIDAS).flatMap(([aba, maos]) =>
    Object.entries(maos).map(([nome, [acao, ev]]) => [aba, nome, acao, ev] as const),
  )
  it.each(TODAS_AS_MAOS_CONFERIDAS)('na aba %s, %s é %s com EV %s', (aba, nome, acao, ev) => {
    expect(maoDaAba(aba, nome)).toMatchObject({ action: acao, ev })
  })
})

describe('3bet contra um open e defesa do BB: sizings', () => {
  const ATE_O_SB = { UTG: 2, HJ: 2, CO: 2.3, BTN: 2.5 }
  const ATE_O_BB = { ...ATE_O_SB, SB: 3 }
  // [aba, 3bet do Hero, open do Hero (ou null), 3bets enfrentados, opens enfrentados, 4bet enfrentado]
  it.each([
    ['3B HJvUTG', 6.5, 2, { CO: 6.5, BTN: 7.5, SB: 11, BB: 12.3 }, { UTG: 2 }, 19],
    ['3B COvUTG', 6.5, 2.3, { BTN: 7.5, SB: 11.5, BB: 13.5 }, { UTG: 2, HJ: 2 }, 18],
    ['3B BTNvUTG', 7.5, 2.5, { SB: 12, BB: 13 }, { UTG: 2, HJ: 2, CO: 2.3 }, 20],
    ['3B SBvUTG', 10, 3, { BB: 10 }, ATE_O_SB, 19],
    ['BBvUTG', 12, null, {}, ATE_O_BB, 22],
    ['3B COvHJ', 6.5, 2.3, { BTN: 7.5, SB: 11.5, BB: 13.5 }, { UTG: 2, HJ: 2 }, 19],
    ['3B BTNvHJ', 7.5, 2.5, { SB: 12, BB: 13 }, { UTG: 2, HJ: 2, CO: 2.3 }, 20],
    ['3B SBvHJ', 11, 3, { BB: 10 }, ATE_O_SB, 22],
    ['BBvHJ', 12.3, null, {}, ATE_O_BB, 25],
    ['3B BTNvCO', 7.5, 2.5, { SB: 12, BB: 13 }, { UTG: 2, HJ: 2, CO: 2.3 }, 21],
    ['3B SBvCO', 11.5, 3, { BB: 10 }, ATE_O_SB, 25],
    ['BBvCO', 13.5, null, {}, ATE_O_BB, 28],
    ['3B SBvBTN', 12, 3, { BB: 10 }, ATE_O_SB, 26],
    ['BBvBTN', 13, null, {}, ATE_O_BB, 27],
    ['BBvSB', 10, null, {}, ATE_O_BB, 21],
  ] as const)('a aba %s dá 3bet de %fbb, com os tamanhos enfrentados da aba', (aba, threeBet, open, vs3bet, vsOpen, vs4bet) => {
    expect(spotDaAba(aba).sizings).toEqual({ ...(open === null ? {} : { open }), threeBet, vs4bet, vs3bet, vsOpen })
  })

  // Coerência entre abas: o que um spot enfrenta é o que a aba de RFI de quem agiu registra.
  it('enfrenta o open do vilão com o mesmo tamanho do RFI dele', () => {
    const violacoes = SPOTS_DE_RESPOSTA.flatMap(([aba, , , vilao]) => {
      const spot = spotDaAba(aba)
      const enfrentado = spot.sizings.vsOpen[vilao]
      const rfi = spotPorHero(vilao).sizings.open
      return enfrentado === rfi ? [] : [`${spot.id}: enfrenta open de ${enfrentado}bb, mas o RFI do ${vilao} é ${rfi}bb`]
    })
    expect(violacoes).toEqual([])
  })

  it('dá 3bet com o mesmo tamanho que a aba de RFI do vilão diz enfrentar', () => {
    const violacoes = SPOTS_DE_RESPOSTA.flatMap(([aba, , hero, vilao]) => {
      const spot = spotDaAba(aba)
      const esperado = spotPorHero(vilao).sizings.vs3bet[hero]
      return spot.sizings.threeBet === esperado
        ? []
        : [`${spot.id}: 3bet de ${spot.sizings.threeBet}bb, mas o RFI do ${vilao} diz enfrentar ${esperado}bb do ${hero}`]
    })
    expect(violacoes).toEqual([])
  })

  it('abre com o mesmo tamanho do RFI do próprio Hero, quando a aba traz o open', () => {
    const violacoes = SPOTS_DE_RESPOSTA.flatMap(([aba, , hero]) => {
      const spot = spotDaAba(aba)
      if (spot.sizings.open === undefined) return []
      const rfi = spotPorHero(hero).sizings.open
      return spot.sizings.open === rfi ? [] : [`${spot.id}: open de ${spot.sizings.open}bb, mas o RFI do ${hero} é ${rfi}bb`]
    })
    expect(violacoes).toEqual([])
  })
})
