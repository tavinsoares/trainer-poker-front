import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type {
  Action,
  Hand,
  InventoryReport,
  Position,
  RangesData,
  Spot,
  SpotFamily,
} from '../../src/data/ranges-types.ts'

// Seam único desta spec: o JSON gerado pelo conversor. O conversor é uma
// caixa-preta; aqui só se confere o que o app vai consumir.
const lerJson = <T>(arquivo: string): T =>
  JSON.parse(readFileSync(resolve(import.meta.dirname, '..', '..', 'data', arquivo), 'utf-8'))
const dados = lerJson<RangesData>('ranges.json')
const relatorio = lerJson<InventoryReport>('ranges.report.json')

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

const contraRegular = dados.spots.filter((s) => s.villain.type === 'regular')
const contraFish = dados.spots.filter((s) => s.villain.type === 'fish')
const rfiContraRegular = contraRegular.filter((s) => s.family === 'rfi')

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

  // As mãos fora do range são cinza e a planilha não as põe na legenda, então ficam de fora daqui.
  // A planilha tem duas inconsistências, conferidas à mão: no MPv3B CO duas mãos são vermelho-escuro
  // (jam), mas a legenda não traz o JAM; no SBv3B BB a legenda traz JAM 4,7%, mas nenhuma mão tem
  // essa cor. Qualquer outra divergência, ou o fim de uma dessas, reprova.
  it('só tem ações que aparecem nas mãos, e toda ação das mãos aparece na legenda, salvo duas inconsistências da planilha', () => {
    const divergencias = dados.spots.flatMap((s) => {
      const nasMaos = new Set<Action>(s.hands.map((h) => h.action).filter((a) => a !== 'out_of_range'))
      // Uma entrada de 0% descreve uma ação que ninguém toma (CALL 100% e FOLD 0% no vs jam do fish).
      const naLegenda = new Set(s.legend.filter((l) => l.percent > 0).map((l) => l.action))
      return [...new Set([...nasMaos, ...naLegenda])]
        .filter((a) => nasMaos.has(a) !== naLegenda.has(a))
        .map((a) => `${s.id}: a ação "${a}" não está nos dois lados (mãos e legenda)`)
    })
    expect(divergencias).toEqual([
      'vs-3bet-hj-vs-co-regular: a ação "jam" não está nos dois lados (mãos e legenda)',
      'vs-3bet-sb-vs-bb-regular: a ação "jam" não está nos dois lados (mãos e legenda)',
    ])
  })

  // Duas legendas da planilha, ambas contra fish, não somam 100%, conferidas à mão: a do SBvBB F soma
  // 39% (6,2 + 13,3 + 19,5) e a do SBv4B BTN F soma 100,3% (11,8 + 88,5, que deveria ser 88,2).
  // Qualquer outra, ou o fim de uma dessas, reprova.
  it('soma 100% por spot, dentro do arredondamento, salvo duas legendas da planilha', () => {
    const violacoes = dados.spots
      .map((s) => ({ id: s.id, soma: Math.round(s.legend.reduce((t, l) => t + l.percent, 0) * 10) / 10 }))
      .filter(({ soma }) => Math.abs(soma - 100) > TOLERANCIA_SOMA_PP)
      .map(({ id, soma }) => `${id}: a legenda soma ${soma}%`)
    expect(violacoes).toEqual([
      'vs-4bet-sb-vs-btn-fish: a legenda soma 100.3%',
      'vs-3bet-sb-vs-bb-fish: a legenda soma 39%',
    ])
  })

  // A legenda não é reproduzível só pelas cores (ver DESVIO_MAXIMO_PP), então o teste é de
  // ordem de grandeza: cada ação fica perto do que as cores mostram. Só vale onde todas as mãos
  // chegam ao spot: com mãos fora do range, a legenda pesa cada mão pela frequência dela no range
  // (no SBv4B UTG, FOLD diz 21,2% e as cores dão 60%), e a comparação deixa de fazer sentido.
  it('tem, para cada ação, um percentual próximo da contagem de mãos da cor', () => {
    const violacoes = dados.spots.filter((s) => !s.hands.some((h) => h.action === 'out_of_range')).flatMap((s) =>
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

  // No RFI, no 3bet e na defesa do BB, fold vale 0 por definição: um EV escrito numa mão de fold
  // só pode ser zero ou arredondamento. Ao enfrentar agressão, mãos mistas pintadas de fold
  // chegam a ter EV positivo (até 4bb no BBv4B SB), então a regra vale só para essas três famílias.
  it('tem EV perto de zero em toda mão de fold que traz EV, no RFI, no 3bet e na defesa do BB', () => {
    const familias: SpotFamily[] = ['rfi', '3bet', 'bb-defense']
    const violacoes = dados.spots
      .filter((s) => familias.includes(s.family))
      .flatMap((s) =>
        s.hands
          .filter((h) => h.action === 'fold' && h.ev !== null && Math.abs(h.ev) > 0.05)
          .map((h) => `${s.id}: mão ${h.hand} é fold, mas tem EV ${h.ev}`),
      )
    expect(violacoes).toEqual([])
  })

  it('nunca tem EV negativo numa mão de fold', () => {
    const violacoes = dados.spots.flatMap((s) =>
      s.hands
        .filter((h) => h.action === 'fold' && h.ev !== null && h.ev < -0.05)
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
    const violacoes = contraRegular.flatMap((s) =>
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

// ---------------------------------------------------------------------------
// Enfrentar agressão contra regular (ticket 5): vs 3bet, vs 4bet e vs jam.
// As tabelas abaixo saíram de um script que lê a planilha por um caminho diferente do do
// conversor (cor da célula, legenda e formas direto do XML), e foram conferidas por amostragem.

const SPOTS_DE_AGRESSAO = [
  ['UTGv3B HJ', 'vs-3bet', 'UTG', 'HJ'],
  ['UTGv3B CO', 'vs-3bet', 'UTG', 'CO'],
  ['UTGv3B BTN', 'vs-3bet', 'UTG', 'BTN'],
  ['UTGv3B SB', 'vs-3bet', 'UTG', 'SB'],
  ['UTGv3B BB', 'vs-3bet', 'UTG', 'BB'],
  ['MPv3B CO', 'vs-3bet', 'HJ', 'CO'],
  ['MPv3B BTN', 'vs-3bet', 'HJ', 'BTN'],
  ['MPv3B SB', 'vs-3bet', 'HJ', 'SB'],
  ['MPv3B BB', 'vs-3bet', 'HJ', 'BB'],
  ['COv3B BTN', 'vs-3bet', 'CO', 'BTN'],
  ['COv3B SB', 'vs-3bet', 'CO', 'SB'],
  ['COv3B BB', 'vs-3bet', 'CO', 'BB'],
  ['BTNv3B SB', 'vs-3bet', 'BTN', 'SB'],
  ['BTNv3B BB', 'vs-3bet', 'BTN', 'BB'],
  ['SBv3B BB', 'vs-3bet', 'SB', 'BB'],
  ['HJv4B UTG', 'vs-4bet', 'HJ', 'UTG'],
  ['COv4B UTG', 'vs-4bet', 'CO', 'UTG'],
  ['COv4B HJ', 'vs-4bet', 'CO', 'HJ'],
  ['BTNv4B UTG', 'vs-4bet', 'BTN', 'UTG'],
  ['BTNv4B HJ', 'vs-4bet', 'BTN', 'HJ'],
  ['BTNv4B CO', 'vs-4bet', 'BTN', 'CO'],
  ['SBv4B UTG', 'vs-4bet', 'SB', 'UTG'],
  ['SBv4B HJ', 'vs-4bet', 'SB', 'HJ'],
  ['SBv4B CO', 'vs-4bet', 'SB', 'CO'],
  ['SBv4B BTN', 'vs-4bet', 'SB', 'BTN'],
  ['BBv4B UTG', 'vs-4bet', 'BB', 'UTG'],
  ['BBv4B HJ', 'vs-4bet', 'BB', 'HJ'],
  ['BBv4B CO', 'vs-4bet', 'BB', 'CO'],
  ['BBv4B BTN', 'vs-4bet', 'BB', 'BTN'],
  ['BBv4B SB', 'vs-4bet', 'BB', 'SB'],
  ['UTGvJAM HJ', 'vs-jam', 'UTG', 'HJ'],
  ['UTGvJAM CO', 'vs-jam', 'UTG', 'CO'],
  ['UTGvJAM BTN', 'vs-jam', 'UTG', 'BTN'],
  ['UTGvJAM SB', 'vs-jam', 'UTG', 'SB'],
  ['UTGvJAM BB', 'vs-jam', 'UTG', 'BB'],
  ['HJvJAM CO', 'vs-jam', 'HJ', 'CO'],
  ['HJvJAM BTN', 'vs-jam', 'HJ', 'BTN'],
  ['HJvJAM SB', 'vs-jam', 'HJ', 'SB'],
  ['HJvJAM BB', 'vs-jam', 'HJ', 'BB'],
  ['COvJAM BTN', 'vs-jam', 'CO', 'BTN'],
  ['COvJAM SB', 'vs-jam', 'CO', 'SB'],
  ['COvJAM BB', 'vs-jam', 'CO', 'BB'],
  ['BTNvJAM SB', 'vs-jam', 'BTN', 'SB'],
  ['BTNvJAM BB', 'vs-jam', 'BTN', 'BB'],
  ['SBvJAM BB', 'vs-jam', 'SB', 'BB'],
] as const

const CONTAGENS_AGRESSAO = [
  ['UTGv3B HJ', 11, 0, 6, 30, 122, 11, 0, 5, 4],
  ['UTGv3B CO', 12, 0, 6, 29, 122, 12, 0, 5, 4],
  ['UTGv3B BTN', 12, 0, 7, 28, 122, 10, 0, 4, 0],
  ['UTGv3B SB', 8, 0, 11, 28, 122, 7, 0, 8, 3],
  ['UTGv3B BB', 5, 0, 10, 32, 122, 4, 0, 8, 0],
  ['MPv3B CO', 10, 2, 11, 39, 107, 10, 2, 9, 3],
  ['MPv3B BTN', 12, 0, 10, 39, 108, 11, 0, 2, 0],
  ['MPv3B SB', 8, 0, 14, 39, 108, 7, 0, 8, 0],
  ['MPv3B BB', 7, 0, 16, 38, 108, 6, 0, 9, 0],
  ['COv3B BTN', 15, 0, 19, 34, 101, 14, 0, 13, 0],
  ['COv3B SB', 10, 0, 24, 34, 101, 8, 0, 14, 0],
  ['COv3B BB', 9, 0, 17, 42, 101, 9, 0, 7, 0],
  ['BTNv3B SB', 10, 0, 35, 56, 68, 7, 0, 24, 0],
  ['BTNv3B BB', 9, 0, 34, 59, 67, 7, 0, 25, 0],
  ['SBv3B BB', 22, 0, 27, 54, 66, 17, 0, 20, 2],
  ['HJv4B UTG', 0, 4, 11, 9, 145, 0, 4, 6, 0],
  ['COv4B UTG', 0, 4, 8, 9, 148, 0, 4, 5, 0],
  ['COv4B HJ', 0, 4, 9, 11, 145, 0, 4, 7, 0],
  ['BTNv4B UTG', 0, 4, 6, 11, 148, 0, 4, 6, 4],
  ['BTNv4B HJ', 0, 4, 9, 12, 144, 0, 4, 9, 3],
  ['BTNv4B CO', 0, 4, 17, 13, 135, 0, 4, 15, 1],
  ['SBv4B UTG', 0, 4, 4, 14, 147, 0, 4, 3, 6],
  ['SBv4B HJ', 0, 4, 7, 15, 143, 0, 4, 6, 4],
  ['SBv4B CO', 0, 7, 7, 17, 138, 0, 7, 4, 5],
  ['SBv4B BTN', 0, 8, 16, 13, 132, 0, 8, 15, 2],
  ['BBv4B UTG', 0, 4, 3, 11, 151, 0, 4, 3, 6],
  ['BBv4B HJ', 0, 4, 5, 14, 146, 0, 4, 4, 3],
  ['BBv4B CO', 0, 6, 7, 17, 139, 0, 6, 4, 8],
  ['BBv4B BTN', 0, 8, 18, 12, 131, 0, 8, 17, 6],
  ['BBv4B SB', 0, 5, 22, 19, 123, 0, 5, 18, 4],
  ['UTGvJAM HJ', 0, 0, 5, 6, 158, 0, 0, 3, 1],
  ['UTGvJAM CO', 0, 0, 5, 7, 157, 0, 0, 3, 1],
  ['UTGvJAM BTN', 0, 0, 5, 7, 157, 0, 0, 5, 0],
  ['UTGvJAM SB', 0, 0, 3, 6, 160, 0, 0, 3, 0],
  ['UTGvJAM BB', 0, 0, 3, 3, 163, 0, 0, 3, 0],
  ['HJvJAM CO', 0, 0, 5, 7, 157, 0, 0, 5, 0],
  ['HJvJAM BTN', 0, 0, 5, 6, 158, 0, 0, 5, 1],
  ['HJvJAM SB', 0, 0, 5, 4, 160, 0, 0, 5, 0],
  ['HJvJAM BB', 0, 0, 4, 4, 161, 0, 0, 4, 0],
  ['COvJAM BTN', 0, 0, 6, 11, 152, 0, 0, 6, 1],
  ['COvJAM SB', 0, 0, 6, 4, 159, 0, 0, 6, 0],
  ['COvJAM BB', 0, 0, 6, 4, 159, 0, 0, 6, 0],
  ['BTNvJAM SB', 0, 0, 7, 4, 158, 0, 0, 7, 0],
  ['BTNvJAM BB', 0, 0, 6, 3, 160, 0, 0, 6, 0],
  ['SBvJAM BB', 0, 0, 8, 18, 143, 0, 0, 8, 4],
] as const

const LEGENDAS_AGRESSAO = [
  ['UTGv3B HJ', [['4BET', 20.8], ['CALL', 20.8], ['FOLD', 58.4]]],
  ['UTGv3B CO', [['4BET', 23.6], ['CALL', 18.3], ['FOLD', 58.1]]],
  ['UTGv3B BTN', [['4BET', 25.2], ['CALL', 9.8], ['FOLD', 64.9]]],
  ['UTGv3B SB', [['4BET', 14.1], ['CALL', 25], ['FOLD', 60.9]]],
  ['UTGv3B BB', [['4BET', 10.4], ['CALL', 23.5], ['FOLD', 66.2]]],
  ['MPv3B CO', [['4BET', 22.4], ['CALL', 18.5], ['FOLD', 59.1]]],
  ['MPv3B BTN', [['4BET', 24.3], ['CALL', 7.9], ['FOLD', 67.8]]],
  ['MPv3B SB', [['4BET', 15.2], ['CALL', 16.7], ['FOLD', 68.1]]],
  ['MPv3B BB', [['4BET', 9.2], ['CALL', 24.2], ['FOLD', 66.6]]],
  ['COv3B BTN', [['4BET', 22.2], ['CALL', 17.3], ['FOLD', 60.5]]],
  ['COv3B SB', [['4BET', 13.8], ['CALL', 20.8], ['FOLD', 65.4]]],
  ['COv3B BB', [['4BET', 10.8], ['CALL', 21.2], ['FOLD', 68]]],
  ['BTNv3B SB', [['4BET', 11.3], ['CALL', 24.9], ['FOLD', 63.8]]],
  ['BTNv3B BB', [['4BET', 11.4], ['CALL', 25], ['FOLD', 63.6]]],
  ['SBv3B BB', [['JAM', 4.7], ['4BET', 16.2], ['CALL', 19.5], ['FOLD', 59.6]]],
  ['HJv4B UTG', [['JAM', 15.1], ['CALL', 42.9], ['FOLD', 42]]],
  ['COv4B UTG', [['JAM', 13.6], ['CALL', 49.9], ['FOLD', 36.5]]],
  ['COv4B HJ', [['JAM', 12.3], ['CALL', 49.2], ['FOLD', 38.5]]],
  ['BTNv4B UTG', [['JAM', 15.5], ['CALL', 45.5], ['FOLD', 39]]],
  ['BTNv4B HJ', [['JAM', 14.7], ['CALL', 47.9], ['FOLD', 37.4]]],
  ['BTNv4B CO', [['JAM', 13.8], ['CALL', 48.5], ['FOLD', 37.7]]],
  ['SBv4B UTG', [['JAM', 26.8], ['CALL', 52], ['FOLD', 21.2]]],
  ['SBv4B HJ', [['JAM', 30], ['CALL', 35], ['FOLD', 35]]],
  ['SBv4B CO', [['JAM', 31.5], ['CALL', 24.8], ['FOLD', 43.7]]],
  ['SBv4B BTN', [['JAM', 24.9], ['CALL', 44.4], ['FOLD', 30.8]]],
  ['BBv4B UTG', [['JAM', 30.8], ['CALL', 36.4], ['FOLD', 32.9]]],
  ['BBv4B HJ', [['JAM', 29.5], ['CALL', 29.9], ['FOLD', 40.7]]],
  ['BBv4B CO', [['JAM', 31.3], ['CALL', 23.8], ['FOLD', 44.9]]],
  ['BBv4B BTN', [['JAM', 23], ['CALL', 45.7], ['FOLD', 31.3]]],
  ['BBv4B SB', [['JAM', 16.5], ['CALL', 48.1], ['FOLD', 35.5]]],
  ['UTGvJAM HJ', [['CALL', 51.9], ['FOLD', 48.1]]],
  ['UTGvJAM CO', [['CALL', 51.9], ['FOLD', 48.1]]],
  ['UTGvJAM BTN', [['CALL', 56.2], ['FOLD', 43.8]]],
  ['UTGvJAM SB', [['CALL', 51.1], ['FOLD', 48.9]]],
  ['UTGvJAM BB', [['CALL', 53.5], ['FOLD', 46.5]]],
  ['HJvJAM CO', [['CALL', 52.9], ['FOLD', 47.1]]],
  ['HJvJAM BTN', [['CALL', 52.8], ['FOLD', 47.2]]],
  ['HJvJAM SB', [['CALL', 54.7], ['FOLD', 45.3]]],
  ['HJvJAM BB', [['CALL', 56.5], ['FOLD', 43.5]]],
  ['COvJAM BTN', [['CALL', 50.3], ['FOLD', 49.7]]],
  ['COvJAM SB', [['CALL', 57.3], ['FOLD', 42.7]]],
  ['COvJAM BB', [['CALL', 60.8], ['FOLD', 39.2]]],
  ['BTNvJAM SB', [['CALL', 58.7], ['FOLD', 41.3]]],
  ['BTNvJAM BB', [['CALL', 60], ['FOLD', 40]]],
  ['SBvJAM BB', [['CALL', 48.1], ['FOLD', 51.9]]],
] as const

const MAOS_AGRESSAO: Record<string, Record<string, readonly [Action, number | null]>> = {
  'UTGv3B HJ': { 'AA': ['raise', 28.07], '76s': ['call', 0.26], 'KQo': ['fold', null] },
  'UTGv3B CO': { 'AA': ['raise', 28.24], '76s': ['call', 0.18], 'KQo': ['fold', null] },
  'UTGv3B BTN': { 'AA': ['raise', 30.75], '76s': ['call', 0], 'KQo': ['fold', null] },
  'UTGv3B SB': { 'AA': ['raise', 33.11], '76s': ['call', 0.08], 'KQo': ['fold', null] },
  'UTGv3B BB': { 'AA': ['raise', 32.4], '76s': ['call', 0.04], 'KQo': ['fold', null] },
  'MPv3B CO': { 'AA': ['raise', 28.99], '76s': ['call', 0.11], 'KQo': ['fold', null] },
  'MPv3B BTN': { 'AA': ['raise', 31.63], '76s': ['call', null], 'KQo': ['fold', null] },
  'MPv3B SB': { 'AA': ['raise', 35.45], '76s': ['call', null], 'KQo': ['fold', null] },
  'MPv3B BB': { 'AA': ['raise', 33.34], '76s': ['call', 0.02], 'KQo': ['fold', null] },
  'COv3B BTN': { 'AA': ['raise', 32.26], '76s': ['call', 0], 'KQo': ['fold', null] },
  'COv3B SB': { 'AA': ['raise', 35.87], '76s': ['call', 0.02], 'KQo': ['raise', null] },
  'COv3B BB': { 'AA': ['raise', 35.8], '76s': ['call', null], 'KQo': ['fold', null] },
  'BTNv3B SB': { 'AA': ['raise', 37.46], '76s': ['call', null], 'KQo': ['call', 0.22] },
  'BTNv3B BB': { 'AA': ['raise', 36.62], '76s': ['call', null], 'KQo': ['call', 0.27] },
  'SBv3B BB': { 'AA': ['raise', 31.76], '76s': ['call', null], 'KQo': ['raise', 0.47] },
  'HJv4B UTG': { 'AA': ['jam', 49.04], '76s': ['out_of_range', null], 'KQo': ['fold', null] },
  'COv4B UTG': { 'AA': ['jam', 48.78], '76s': ['out_of_range', null], 'KQo': ['fold', null] },
  'COv4B HJ': { 'AA': ['call', 50.32], '76s': ['out_of_range', null], 'KQo': ['fold', null] },
  'BTNv4B UTG': { 'AA': ['jam', 53.19], '76s': ['out_of_range', null], 'KQo': ['fold', null] },
  'BTNv4B HJ': { 'AA': ['call', 53.83], '76s': ['out_of_range', null], 'KQo': ['fold', null] },
  'BTNv4B CO': { 'AA': ['call', 55.11], '76s': ['call', 0.41], 'KQo': ['fold', null] },
  'SBv4B UTG': { 'AA': ['jam', 49.3], '76s': ['out_of_range', null], 'KQo': ['fold', null] },
  'SBv4B HJ': { 'AA': ['jam', 55.55], '76s': ['call', 0.66], 'KQo': ['fold', null] },
  'SBv4B CO': { 'AA': ['jam', 59.67], '76s': ['out_of_range', null], 'KQo': ['fold', null] },
  'SBv4B BTN': { 'AA': ['jam', 61.37], '76s': ['call', 0.69], 'KQo': ['fold', null] },
  'BBv4B UTG': { 'AA': ['jam', 51.93], '76s': ['fold', 0.01], 'KQo': ['out_of_range', null] },
  'BBv4B HJ': { 'AA': ['jam', 56.36], '76s': ['fold', null], 'KQo': ['out_of_range', null] },
  'BBv4B CO': { 'AA': ['jam', 64.82], '76s': ['fold', 0.21], 'KQo': ['fold', null] },
  'BBv4B BTN': { 'AA': ['jam', 63.69], '76s': ['call', 0.79], 'KQo': ['fold', null] },
  'BBv4B SB': { 'AA': ['call', 56.38], '76s': ['call', 2.03], 'KQo': ['fold', 3.53] },
  'UTGvJAM HJ': { 'AA': ['call', 91.05], '76s': ['out_of_range', null], 'KQo': ['out_of_range', null] },
  'UTGvJAM CO': { 'AA': ['call', 90.29], '76s': ['out_of_range', null], 'KQo': ['out_of_range', null] },
  'UTGvJAM BTN': { 'AA': ['call', 91.66], '76s': ['out_of_range', null], 'KQo': ['out_of_range', null] },
  'UTGvJAM SB': { 'AA': ['call', 90.74], '76s': ['out_of_range', null], 'KQo': ['out_of_range', null] },
  'UTGvJAM BB': { 'AA': ['call', 91.61], '76s': ['out_of_range', null], 'KQo': ['out_of_range', null] },
  'HJvJAM CO': { 'AA': ['call', 91.6], '76s': ['out_of_range', null], 'KQo': ['out_of_range', null] },
  'HJvJAM BTN': { 'AA': ['call', 92.49], '76s': ['out_of_range', null], 'KQo': ['out_of_range', null] },
  'HJvJAM SB': { 'AA': ['call', 92.7], '76s': ['out_of_range', null], 'KQo': ['out_of_range', null] },
  'HJvJAM BB': { 'AA': ['call', 93.27], '76s': ['out_of_range', null], 'KQo': ['out_of_range', null] },
  'COvJAM BTN': { 'AA': ['call', 93.39], '76s': ['out_of_range', null], 'KQo': ['out_of_range', null] },
  'COvJAM SB': { 'AA': ['call', 92.83], '76s': ['out_of_range', null], 'KQo': ['fold', null] },
  'COvJAM BB': { 'AA': ['call', 95.83], '76s': ['out_of_range', null], 'KQo': ['out_of_range', null] },
  'BTNvJAM SB': { 'AA': ['call', 94.25], '76s': ['out_of_range', null], 'KQo': ['out_of_range', null] },
  'BTNvJAM BB': { 'AA': ['call', 95.19], '76s': ['out_of_range', null], 'KQo': ['out_of_range', null] },
  'SBvJAM BB': { 'AA': ['call', 91.49], '76s': ['out_of_range', null], 'KQo': ['fold', null] },
}

const SIZINGS_AGRESSAO = [
  ['UTGv3B HJ', { open: 2, fourBet: 19, vs3bet: { HJ: 6.5, CO: 6.5, BTN: 7.5, SB: 10, BB: 12 }, vsOpen: {} }],
  ['UTGv3B CO', { open: 2, fourBet: 18, vs3bet: { HJ: 6.5, CO: 6.5, BTN: 7.5, SB: 10, BB: 12 }, vsOpen: {} }],
  ['UTGv3B BTN', { open: 2, fourBet: 20, vs3bet: { HJ: 6.5, CO: 6.5, BTN: 7.5, SB: 10, BB: 12 }, vsOpen: {} }],
  ['UTGv3B SB', { open: 2, fourBet: 19, vs3bet: { HJ: 6.5, CO: 6.5, BTN: 7.5, SB: 10, BB: 12 }, vsOpen: {} }],
  ['UTGv3B BB', { open: 2, fourBet: 22, vs3bet: { HJ: 6.5, CO: 6.5, BTN: 7.5, SB: 10, BB: 12 }, vsOpen: {} }],
  ['MPv3B CO', { open: 2, fourBet: 19, vs3bet: { CO: 6.5, BTN: 7.5, SB: 11, BB: 12.3 }, vsOpen: { UTG: 2 } }],
  ['MPv3B BTN', { open: 2, fourBet: 20, vs3bet: { CO: 6.5, BTN: 7.5, SB: 11, BB: 12.3 }, vsOpen: { UTG: 2 } }],
  ['MPv3B SB', { open: 2, fourBet: 22, vs3bet: { CO: 6.5, BTN: 7.5, SB: 11, BB: 12.3 }, vsOpen: { UTG: 2 } }],
  ['MPv3B BB', { open: 2, fourBet: 25, vs3bet: { CO: 6.5, BTN: 7.5, SB: 11, BB: 12.3 }, vsOpen: { UTG: 2 } }],
  ['COv3B BTN', { open: 2.3, fourBet: 21, vs3bet: { BTN: 7.5, SB: 11.5, BB: 13.5 }, vsOpen: { UTG: 2, HJ: 2 } }],
  ['COv3B SB', { open: 2.3, fourBet: 25, vs3bet: { BTN: 7.5, SB: 11.5, BB: 13.5 }, vsOpen: { UTG: 2, HJ: 2 } }],
  ['COv3B BB', { open: 2.3, fourBet: 28, vs3bet: { BTN: 7.5, SB: 11.5, BB: 13.5 }, vsOpen: { UTG: 2, HJ: 2 } }],
  ['BTNv3B SB', { open: 2.5, fourBet: 26, vs3bet: { SB: 12, BB: 13 }, vsOpen: { UTG: 2, HJ: 2, CO: 2.3 } }],
  ['BTNv3B BB', { open: 2.5, fourBet: 27, vs3bet: { SB: 12, BB: 13 }, vsOpen: { UTG: 2, HJ: 2, CO: 2.3 } }],
  ['SBv3B BB', { open: 3, fourBet: 21, vs3bet: { BB: 10 }, vsOpen: { UTG: 2, HJ: 2, CO: 2.3, BTN: 2.5 } }],
  ['HJv4B UTG', { open: 2, vs4bet: 19, vs3bet: { CO: 6.5, BTN: 7.5, SB: 11, BB: 12.3 }, vsOpen: { UTG: 2 } }],
  ['COv4B UTG', { open: 2.3, vs4bet: 18, vs3bet: { BTN: 7.5, SB: 11.5, BB: 13.5 }, vsOpen: { UTG: 2, HJ: 2 } }],
  ['COv4B HJ', { open: 2.3, vs4bet: 19, vs3bet: { BTN: 7.5, SB: 11.5, BB: 13.5 }, vsOpen: { UTG: 2, HJ: 2 } }],
  ['BTNv4B UTG', { open: 2.5, vs4bet: 20, vs3bet: { SB: 12, BB: 13 }, vsOpen: { UTG: 2, HJ: 2, CO: 2.3 } }],
  ['BTNv4B HJ', { open: 2.5, vs4bet: 20, vs3bet: { SB: 12, BB: 13 }, vsOpen: { UTG: 2, HJ: 2, CO: 2.3 } }],
  ['BTNv4B CO', { open: 2.5, vs4bet: 21, vs3bet: { SB: 12, BB: 13 }, vsOpen: { UTG: 2, HJ: 2, CO: 2.3 } }],
  ['SBv4B UTG', { open: 3, vs4bet: 19, vs3bet: { BB: 10 }, vsOpen: { UTG: 2, HJ: 2, CO: 2.3, BTN: 2.5 } }],
  ['SBv4B HJ', { open: 3, vs4bet: 22, vs3bet: { BB: 10 }, vsOpen: { UTG: 2, HJ: 2, CO: 2.3, BTN: 2.5 } }],
  ['SBv4B CO', { open: 3, vs4bet: 25, vs3bet: { BB: 10 }, vsOpen: { UTG: 2, HJ: 2, CO: 2.3, BTN: 2.5 } }],
  ['SBv4B BTN', { open: 3, vs4bet: 26, vs3bet: { BB: 10 }, vsOpen: { UTG: 2, HJ: 2, CO: 2.3, BTN: 2.5 } }],
  ['BBv4B UTG', { vs4bet: 22, vs3bet: {}, vsOpen: { UTG: 2, HJ: 2, CO: 2.3, BTN: 2.5, SB: 3 } }],
  ['BBv4B HJ', { vs4bet: 25, vs3bet: {}, vsOpen: { UTG: 2, HJ: 2, CO: 2.3, BTN: 2.5, SB: 3 } }],
  ['BBv4B CO', { vs4bet: 28, vs3bet: {}, vsOpen: { UTG: 2, HJ: 2, CO: 2.3, BTN: 2.5, SB: 3 } }],
  ['BBv4B BTN', { vs4bet: 27, vs3bet: {}, vsOpen: { UTG: 2, HJ: 2, CO: 2.3, BTN: 2.5, SB: 3 } }],
  ['BBv4B SB', { vs4bet: 21, vs3bet: {}, vsOpen: { UTG: 2, HJ: 2, CO: 2.3, BTN: 2.5, SB: 3 } }],
  ['UTGvJAM HJ', { open: 2, vs3bet: { HJ: 6.5, CO: 6.5, BTN: 7.5, SB: 10, BB: 12 }, vsOpen: {} }],
  ['UTGvJAM CO', { open: 2, vs3bet: { HJ: 6.5, CO: 6.5, BTN: 7.5, SB: 10, BB: 12 }, vsOpen: {} }],
  ['UTGvJAM BTN', { open: 2, vs3bet: { HJ: 6.5, CO: 6.5, BTN: 7.5, SB: 10, BB: 12 }, vsOpen: {} }],
  ['UTGvJAM SB', { open: 2, vs3bet: { HJ: 6.5, CO: 6.5, BTN: 7.5, SB: 10, BB: 12 }, vsOpen: {} }],
  ['UTGvJAM BB', { open: 2, vs3bet: { HJ: 6.5, CO: 6.5, BTN: 7.5, SB: 10, BB: 12 }, vsOpen: {} }],
  ['HJvJAM CO', { open: 2, vs3bet: { CO: 6.5, BTN: 7.5, SB: 11, BB: 12.3 }, vsOpen: { UTG: 2 } }],
  ['HJvJAM BTN', { open: 2, vs3bet: { CO: 6.5, BTN: 7.5, SB: 11, BB: 12.3 }, vsOpen: { UTG: 2 } }],
  ['HJvJAM SB', { open: 2, vs3bet: { CO: 6.5, BTN: 7.5, SB: 11, BB: 12.3 }, vsOpen: { UTG: 2 } }],
  ['HJvJAM BB', { open: 2, vs3bet: { CO: 6.5, BTN: 7.5, SB: 11, BB: 12.3 }, vsOpen: { UTG: 2 } }],
  ['COvJAM BTN', { open: 2.3, vs3bet: { BTN: 7.5, SB: 11.5, BB: 13.5 }, vsOpen: { UTG: 2, HJ: 2 } }],
  ['COvJAM SB', { open: 2.3, vs3bet: { BTN: 7.5, SB: 11.5, BB: 13.5 }, vsOpen: { UTG: 2, HJ: 2 } }],
  ['COvJAM BB', { open: 2.3, vs3bet: { BTN: 7.5, SB: 11.5, BB: 13.5 }, vsOpen: { UTG: 2, HJ: 2 } }],
  ['BTNvJAM SB', { open: 2.5, vs3bet: { SB: 12, BB: 13 }, vsOpen: { UTG: 2, HJ: 2, CO: 2.3 } }],
  ['BTNvJAM BB', { open: 2.5, vs3bet: { SB: 12, BB: 13 }, vsOpen: { UTG: 2, HJ: 2, CO: 2.3 } }],
  ['SBvJAM BB', { open: 3, vs3bet: { BB: 10 }, vsOpen: { UTG: 2, HJ: 2, CO: 2.3, BTN: 2.5 } }],
] as const

const ACAO_DO_ROTULO = { RFI: 'raise', '3BET': 'raise', '4BET': 'raise', JAM: 'jam', CALL: 'call', FOLD: 'fold' } as const

describe('enfrentar agressão: spots', () => {
  it('tem os 15 spots de cada família (vs 3bet, vs 4bet e vs jam) contra regular, um por aba', () => {
    const familia = (f: SpotFamily) =>
      dados.spots.filter((s) => s.family === f && s.villain.type === 'regular').map((s) => s.sourceSheet).sort()
    const esperadas = (f: SpotFamily) =>
      SPOTS_DE_AGRESSAO.filter((linha) => linha[1] === f).map((linha) => linha[0]).sort()
    for (const f of ['vs-3bet', 'vs-4bet', 'vs-jam'] as const) {
      expect(esperadas(f)).toHaveLength(15)
      expect(familia(f)).toEqual(esperadas(f))
    }
  })

  // O MP da planilha aparece como HJ, no Hero e no vilão.
  it.each(SPOTS_DE_AGRESSAO)('a aba %s é da família %s, com Hero %s contra o %s', (aba, familia, hero, vilao) => {
    const spot = spotDaAba(aba)
    expect(spot).toMatchObject({ family: familia, hero, villain: { type: 'regular', position: vilao } })
    expect(spot.id).toBe(`${familia}-${hero}-vs-${vilao}-regular`.toLowerCase())
  })
})

describe('enfrentar agressão: mãos e legenda', () => {
  // [aba, mãos de raise, jam, call, fold, fora do range, e as com EV de raise, jam, call, fold]
  it.each(CONTAGENS_AGRESSAO)(
    'na aba %s há %i mãos de 4bet, %i de jam, %i de call, %i de fold e %i fora do range',
    (aba, r, j, c, f, fora, rEv, jEv, cEv, fEv) => {
      expect([
        contaMaos(aba, 'raise'), contaMaos(aba, 'jam'), contaMaos(aba, 'call'), contaMaos(aba, 'fold'), contaMaos(aba, 'out_of_range'),
        contaMaos(aba, 'raise', true), contaMaos(aba, 'jam', true), contaMaos(aba, 'call', true), contaMaos(aba, 'fold', true),
      ]).toEqual([r, j, c, f, fora, rEv, jEv, cEv, fEv])
    },
  )

  // Na legenda de cada aba o JAM é salmão ou vermelho-escuro, e o 4BET é salmão: a cor sozinha não diz a ação.
  it.each(LEGENDAS_AGRESSAO)('a legenda da aba %s traz os rótulos e percentuais da planilha', (aba, entradas) => {
    expect(spotDaAba(aba).legend).toEqual(
      entradas.map(([label, percent]) => ({ label, action: ACAO_DO_ROTULO[label], percent })),
    )
  })

  const TODAS_AS_MAOS_AGRESSAO = Object.entries(MAOS_AGRESSAO).flatMap(([aba, maos]) =>
    Object.entries(maos).map(([nome, [acao, ev]]) => [aba, nome, acao, ev] as const),
  )
  it.each(TODAS_AS_MAOS_AGRESSAO)('na aba %s, %s é %s com EV %s', (aba, nome, acao, ev) => {
    expect(maoDaAba(aba, nome)).toMatchObject({ action: acao, ev })
  })

  // No MPv3B CO duas mãos são vermelho-escuro (jam), mas a legenda da aba não traz o JAM.
  it('lê o vermelho-escuro como jam mesmo quando a legenda da aba não o cita', () => {
    expect(maoDaAba('MPv3B CO', 'AKo')).toMatchObject({ action: 'jam', label: 'JAM', ev: 2.46 })
    expect(maoDaAba('MPv3B CO', 'QQ')).toMatchObject({ action: 'jam', label: 'JAM', ev: 7.62 })
    expect(spotDaAba('MPv3B CO').legend.map((l) => l.label)).not.toContain('JAM')
  })
})

describe('mãos fora do range', () => {
  it('são as células cinza, com o rótulo FORA DO RANGE e sem EV', () => {
    const violacoes = dados.spots.flatMap((s) =>
      s.hands
        .filter((h) => h.action === 'out_of_range' && (h.ev !== null || h.label !== 'FORA DO RANGE'))
        .map((h) => `${s.id}: mão ${h.hand} fora do range tem rótulo "${h.label}" e EV ${h.ev}`),
    )
    expect(violacoes).toEqual([])
  })

  it('só existem nos spots de enfrentar agressão', () => {
    const familias = new Set(dados.spots.filter((s) => s.hands.some((h) => h.action === 'out_of_range')).map((s) => s.family))
    expect([...familias].sort()).toEqual(['vs-3bet', 'vs-4bet', 'vs-jam'])
  })

  // As mãos cinza nunca são sorteadas, então o range de cada spot tem de sobrar alguma mão.
  it('deixam sempre mãos dentro do range, com fold ou outra ação', () => {
    const vazios = dados.spots.filter((s) => s.hands.every((h) => h.action === 'out_of_range')).map((s) => s.id)
    expect(vazios).toEqual([])
  })
})

describe('enfrentar agressão: sizings', () => {
  // Lidos à mão nas formas de cada aba (coluna do vilão regular).
  it.each(SIZINGS_AGRESSAO)('os tamanhos da aba %s batem com as formas da aba', (aba, esperado) => {
    const spot = spotDaAba(aba)
    // Ao enfrentar 4bet, a aba não traz o 3bet do Hero: ele vem do RFI do vilão.
    const derivado =
      spot.family === 'vs-4bet' && spot.villain.position
        ? { threeBet: spotPorHero(spot.villain.position).sizings.vs3bet[spot.hero] }
        : {}
    expect(spot.sizings).toEqual({ ...esperado, ...derivado })
  })

  // Contra fish a planilha não traz esses tamanhos (ver o describe de sizings contra fish).
  it('traz, em cada família contra regular, os tamanhos necessários para montar o spot', () => {
    const violacoes = contraRegular.flatMap((s) => {
      const z = s.sizings
      const vilao = s.villain.position
      const faltas =
        s.family === 'vs-3bet'
          ? [z.open, z.fourBet, vilao ? z.vs3bet[vilao] : undefined]
          : s.family === 'vs-4bet'
            ? [z.threeBet, z.vs4bet, vilao ? z.vsOpen[vilao] : undefined]
            : s.family === 'vs-jam'
              ? [z.open]
              : []
      return faltas.some((v) => v === undefined) ? [`${s.id}: faltam tamanhos de aposta (${JSON.stringify(z)})`] : []
    })
    expect(violacoes).toEqual([])
  })

  // Coerência entre abas: o 4bet que o Hero enfrenta é o 4bet que a aba espelho do vilão diz dar.
  it('enfrenta, no vs 4bet, o mesmo 4bet que a aba de vs 3bet do vilão diz dar', () => {
    const violacoes = contraRegular
      .filter((s) => s.family === 'vs-4bet')
      .flatMap((s) => {
        const espelho = contraRegular.find(
          (x) => x.family === 'vs-3bet' && x.hero === s.villain.position && x.villain.position === s.hero,
        )
        if (!espelho) return [`${s.id}: não há o spot de vs 3bet correspondente`]
        return espelho.sizings.fourBet === s.sizings.vs4bet
          ? []
          : [`${s.id}: enfrenta 4bet de ${s.sizings.vs4bet}bb, mas ${espelho.id} diz dar ${espelho.sizings.fourBet}bb`]
      })
    expect(violacoes).toEqual([])
  })

  it('abre, no vs 3bet e no vs jam, com o mesmo tamanho do RFI do Hero, e enfrenta o 3bet que o RFI diz', () => {
    const violacoes = contraRegular
      .filter((s) => s.family === 'vs-3bet' || s.family === 'vs-jam')
      .flatMap((s) => {
        const rfi = spotPorHero(s.hero).sizings
        const vilao = s.villain.position
        const erros = []
        if (s.sizings.open !== rfi.open) erros.push(`${s.id}: abre ${s.sizings.open}bb, mas o RFI do ${s.hero} é ${rfi.open}bb`)
        if (s.family === 'vs-3bet' && vilao && s.sizings.vs3bet[vilao] !== rfi.vs3bet[vilao]) {
          erros.push(`${s.id}: enfrenta 3bet de ${s.sizings.vs3bet[vilao]}bb, mas o RFI do ${s.hero} diz ${rfi.vs3bet[vilao]}bb`)
        }
        return erros
      })
    expect(violacoes).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Spots contra fish (ticket 6). As tabelas abaixo saíram de um script que lê a planilha por um
// caminho diferente do do conversor, e decide a família de cada aba pela posição.

const SPOTS_FISH = [
  ['HJvUTG F', '3bet', 'HJ', 'UTG'],
  ['HJv4B UTG F', 'vs-4bet', 'HJ', 'UTG'],
  ['COvUTG F', '3bet', 'CO', 'UTG'],
  ['COv4B UTG F', 'vs-4bet', 'CO', 'UTG'],
  ['BTNvUTG F', '3bet', 'BTN', 'UTG'],
  ['BTNv4B UTG F', 'vs-4bet', 'BTN', 'UTG'],
  ['COvHJ F', '3bet', 'CO', 'HJ'],
  ['COv4B HJ F', 'vs-4bet', 'CO', 'HJ'],
  ['BTNvHJ F', '3bet', 'BTN', 'HJ'],
  ['BTNv4B HJ F', 'vs-4bet', 'BTN', 'HJ'],
  ['BTNvCO F', '3bet', 'BTN', 'CO'],
  ['BTNv4B CO F', 'vs-4bet', 'BTN', 'CO'],
  ['BBvUTG F', 'bb-defense', 'BB', 'UTG'],
  ['BBv4B UTG F', 'vs-4bet', 'BB', 'UTG'],
  ['BBvHJ F', 'bb-defense', 'BB', 'HJ'],
  ['BBv4B HJ F', 'vs-4bet', 'BB', 'HJ'],
  ['BBvCO F', 'bb-defense', 'BB', 'CO'],
  ['BBv4B CO F', 'vs-4bet', 'BB', 'CO'],
  ['BBvBTN F', 'bb-defense', 'BB', 'BTN'],
  ['BBv4B BTN F', 'vs-4bet', 'BB', 'BTN'],
  ['BBvSB F', 'bb-defense', 'BB', 'SB'],
  ['BBv4B SB F', 'vs-4bet', 'BB', 'SB'],
  ['SBvUTG F', '3bet', 'SB', 'UTG'],
  ['SBv4B UTG F', 'vs-4bet', 'SB', 'UTG'],
  ['SBvHJ F', '3bet', 'SB', 'HJ'],
  ['SBv4B HJ F', 'vs-4bet', 'SB', 'HJ'],
  ['SBvCO F', '3bet', 'SB', 'CO'],
  ['SBv4B CO F', 'vs-4bet', 'SB', 'CO'],
  ['SBvBTN F', '3bet', 'SB', 'BTN'],
  ['SBv4B BTN F', 'vs-4bet', 'SB', 'BTN'],
  ['UTGvHJ F', 'vs-3bet', 'UTG', 'HJ'],
  ['UTGvJAM HJ F', 'vs-jam', 'UTG', 'HJ'],
  ['UTGvCO F', 'vs-3bet', 'UTG', 'CO'],
  ['UTGvJAM CO F', 'vs-jam', 'UTG', 'CO'],
  ['UTGvBTN F', 'vs-3bet', 'UTG', 'BTN'],
  ['UTGvJAM BTN F', 'vs-jam', 'UTG', 'BTN'],
  ['UTGvSB F', 'vs-3bet', 'UTG', 'SB'],
  ['UTGvJAM SB F', 'vs-jam', 'UTG', 'SB'],
  ['UTGvBB F', 'vs-3bet', 'UTG', 'BB'],
  ['UTGvJAM BB F', 'vs-jam', 'UTG', 'BB'],
  ['HJvCO F', 'vs-3bet', 'HJ', 'CO'],
  ['HJvJAM CO F', 'vs-jam', 'HJ', 'CO'],
  ['HJvBTN F', 'vs-3bet', 'HJ', 'BTN'],
  ['HJvJAM BTN F', 'vs-jam', 'HJ', 'BTN'],
  ['HJvSB F', 'vs-3bet', 'HJ', 'SB'],
  ['HJvJAM SB F', 'vs-jam', 'HJ', 'SB'],
  ['HJvBB F', 'vs-3bet', 'HJ', 'BB'],
  ['HJvJAM BB F', 'vs-jam', 'HJ', 'BB'],
  ['COvBTN F', 'vs-3bet', 'CO', 'BTN'],
  ['COvJAM BTN F', 'vs-jam', 'CO', 'BTN'],
  ['COvSB F', 'vs-3bet', 'CO', 'SB'],
  ['COvJAM SB F', 'vs-jam', 'CO', 'SB'],
  ['COvBB F', 'vs-3bet', 'CO', 'BB'],
  ['COvJAM BB F', 'vs-jam', 'CO', 'BB'],
  ['BTNvSB F', 'vs-3bet', 'BTN', 'SB'],
  ['BTNvJAM SB F', 'vs-jam', 'BTN', 'SB'],
  ['BTNvBB F', 'vs-3bet', 'BTN', 'BB'],
  ['BTNvJAM BB F', 'vs-jam', 'BTN', 'BB'],
  ['SBvBB F', 'vs-3bet', 'SB', 'BB'],
  ['SBvJAM BB F', 'vs-jam', 'SB', 'BB'],
  ['OR BTNvF', 'rfi', 'BTN', null],
  ['OR SBvF', 'rfi', 'SB', null],
] as const

const CONTAGENS_FISH = [
  ['HJvUTG F', 24, 0, 0, 145, 0],
  ['HJv4B UTG F', 0, 2, 0, 22, 145],
  ['COvUTG F', 24, 0, 0, 145, 0],
  ['COv4B UTG F', 0, 2, 0, 22, 145],
  ['BTNvUTG F', 24, 0, 0, 145, 0],
  ['BTNv4B UTG F', 0, 2, 0, 22, 145],
  ['COvHJ F', 29, 0, 0, 140, 0],
  ['COv4B HJ F', 0, 5, 0, 24, 140],
  ['BTNvHJ F', 29, 0, 0, 140, 0],
  ['BTNv4B HJ F', 0, 5, 0, 24, 140],
  ['BTNvCO F', 45, 0, 0, 124, 0],
  ['BTNv4B CO F', 0, 5, 0, 40, 124],
  ['BBvUTG F', 21, 0, 57, 91, 0],
  ['BBv4B UTG F', 0, 2, 0, 19, 148],
  ['BBvHJ F', 26, 0, 57, 86, 0],
  ['BBv4B HJ F', 0, 2, 0, 24, 143],
  ['BBvCO F', 34, 0, 60, 75, 0],
  ['BBv4B CO F', 0, 5, 0, 29, 135],
  ['BBvBTN F', 51, 0, 61, 57, 0],
  ['BBv4B BTN F', 0, 5, 0, 46, 118],
  ['BBvSB F', 29, 0, 109, 31, 0],
  ['BBv4B SB F', 0, 5, 0, 24, 140],
  ['SBvUTG F', 22, 0, 0, 147, 0],
  ['SBv4B UTG F', 0, 2, 0, 20, 147],
  ['SBvHJ F', 25, 0, 0, 144, 0],
  ['SBv4B HJ F', 0, 2, 0, 23, 144],
  ['SBvCO F', 35, 0, 0, 134, 0],
  ['SBv4B CO F', 0, 5, 0, 30, 134],
  ['SBvBTN F', 51, 0, 0, 118, 0],
  ['SBv4B BTN F', 0, 5, 0, 46, 118],
  ['UTGvHJ F', 5, 0, 23, 28, 113],
  ['UTGvJAM HJ F', 0, 0, 4, 1, 164],
  ['UTGvCO F', 5, 0, 23, 28, 113],
  ['UTGvJAM CO F', 0, 0, 4, 1, 164],
  ['UTGvBTN F', 5, 0, 23, 28, 113],
  ['UTGvJAM BTN F', 0, 0, 4, 1, 164],
  ['UTGvSB F', 5, 0, 25, 26, 113],
  ['UTGvJAM SB F', 0, 0, 3, 2, 164],
  ['UTGvBB F', 6, 0, 32, 18, 113],
  ['UTGvJAM BB F', 0, 0, 2, 4, 163],
  ['HJvCO F', 5, 0, 23, 33, 108],
  ['HJvJAM CO F', 0, 0, 4, 1, 164],
  ['HJvBTN F', 5, 0, 23, 33, 108],
  ['HJvJAM BTN F', 0, 0, 4, 1, 164],
  ['HJvSB F', 5, 0, 36, 20, 108],
  ['HJvJAM SB F', 0, 0, 3, 2, 164],
  ['HJvBB F', 6, 0, 38, 17, 108],
  ['HJvJAM BB F', 0, 0, 2, 4, 163],
  ['COvBTN F', 13, 0, 25, 35, 96],
  ['COvJAM BTN F', 0, 0, 4, 9, 156],
  ['COvSB F', 5, 0, 46, 22, 96],
  ['COvJAM SB F', 0, 0, 4, 1, 164],
  ['COvBB F', 6, 0, 38, 29, 96],
  ['COvJAM BB F', 0, 0, 5, 1, 163],
  ['BTNvSB F', 4, 0, 53, 61, 51],
  ['BTNvJAM SB F', 0, 0, 4, 0, 165],
  ['BTNvBB F', 7, 0, 66, 46, 50],
  ['BTNvJAM BB F', 0, 0, 7, 0, 162],
  ['SBvBB F', 10, 0, 25, 96, 38],
  ['SBvJAM BB F', 0, 0, 10, 0, 159],
  ['OR BTNvF', 118, 0, 0, 51, 0],
  ['OR SBvF', 131, 0, 0, 38, 0],
] as const

const LEGENDAS_FISH = [
  ['HJvUTG F', [['3BET', 9.5], ['FOLD', 90.5]]],
  ['HJv4B UTG F', [['JAM', 9.5], ['FOLD', 90.5]]],
  ['COvUTG F', [['3BET', 9.5], ['FOLD', 90.5]]],
  ['COv4B UTG F', [['JAM', 9.5], ['FOLD', 90.5]]],
  ['BTNvUTG F', [['3BET', 9.5], ['FOLD', 90.5]]],
  ['BTNv4B UTG F', [['JAM', 9.5], ['FOLD', 90.5]]],
  ['COvHJ F', [['3BET', 12.4], ['FOLD', 87.6]]],
  ['COv4B HJ F', [['JAM', 20.7], ['FOLD', 79.3]]],
  ['BTNvHJ F', [['3BET', 12.4], ['FOLD', 87.6]]],
  ['BTNv4B HJ F', [['JAM', 20.7], ['FOLD', 79.3]]],
  ['BTNvCO F', [['3BET', 18.7], ['FOLD', 81.3]]],
  ['BTNv4B CO F', [['JAM', 13.7], ['FOLD', 86.3]]],
  ['BBvUTG F', [['3BET', 7.8], ['CALL', 23.7], ['FOLD', 68.5]]],
  ['BBv4B UTG F', [['JAM', 11.5], ['FOLD', 88.5]]],
  ['BBvHJ F', [['3BET', 10.1], ['CALL', 23.5], ['FOLD', 66.4]]],
  ['BBv4B HJ F', [['JAM', 9], ['FOLD', 91]]],
  ['BBvCO F', [['3BET', 13.9], ['CALL', 26.1], ['FOLD', 60]]],
  ['BBv4B CO F', [['JAM', 18.5], ['FOLD', 81.5]]],
  ['BBvBTN F', [['3BET', 22.3], ['CALL', 32.4], ['FOLD', 45.3]]],
  ['BBv4B BTN F', [['JAM', 11.5], ['FOLD', 88.5]]],
  ['BBvSB F', [['3BET', 12.8], ['CALL', 59.1], ['FOLD', 28.1]]],
  ['BBv4B SB F', [['JAM', 20], ['FOLD', 80]]],
  ['SBvUTG F', [['3BET', 8.8], ['FOLD', 91.2]]],
  ['SBv4B UTG F', [['JAM', 10.3], ['FOLD', 89.7]]],
  ['SBvHJ F', [['3BET', 10.4], ['FOLD', 89.6]]],
  ['SBv4B HJ F', [['JAM', 8.7], ['FOLD', 91.3]]],
  ['SBvCO F', [['3BET', 14.9], ['FOLD', 85.1]]],
  ['SBv4B CO F', [['JAM', 17.2], ['FOLD', 82.8]]],
  ['SBvBTN F', [['3BET', 21.7], ['FOLD', 78.3]]],
  ['SBv4B BTN F', [['JAM', 11.8], ['FOLD', 88.5]]],
  ['UTGvHJ F', [['4BET', 10.8], ['CALL', 28.6], ['FOLD', 60.6]]],
  ['UTGvJAM HJ F', [['CALL', 78.6], ['FOLD', 21.4]]],
  ['UTGvCO F', [['4BET', 10.8], ['CALL', 28.6], ['FOLD', 60.6]]],
  ['UTGvJAM CO F', [['CALL', 78.6], ['FOLD', 21.4]]],
  ['UTGvBTN F', [['4BET', 10.8], ['CALL', 28.6], ['FOLD', 60.6]]],
  ['UTGvJAM BTN F', [['CALL', 78.6], ['FOLD', 21.4]]],
  ['UTGvSB F', [['4BET', 10], ['CALL', 43.4], ['FOLD', 46.6]]],
  ['UTGvJAM SB F', [['CALL', 61.5], ['FOLD', 38.5]]],
  ['UTGvBB F', [['4BET', 9.3], ['CALL', 52.3], ['FOLD', 38.4]]],
  ['UTGvJAM BB F', [['CALL', 50], ['FOLD', 50]]],
  ['HJvCO F', [['4BET', 10.8], ['CALL', 28.6], ['FOLD', 60.6]]],
  ['HJvJAM CO F', [['CALL', 78.6], ['FOLD', 21.4]]],
  ['HJvBTN F', [['4BET', 10.8], ['CALL', 28.6], ['FOLD', 60.6]]],
  ['HJvJAM BTN F', [['CALL', 78.6], ['FOLD', 21.4]]],
  ['HJvSB F', [['4BET', 8.1], ['CALL', 42], ['FOLD', 49.9]]],
  ['HJvJAM SB F', [['CALL', 61.5], ['FOLD', 38.5]]],
  ['HJvBB F', [['4BET', 7.5], ['CALL', 51.9], ['FOLD', 40.6]]],
  ['HJvJAM BB F', [['CALL', 50], ['FOLD', 50]]],
  ['COvBTN F', [['4BET', 11.7], ['CALL', 21.1], ['FOLD', 67.2]]],
  ['COvJAM BTN F', [['CALL', 47.8], ['FOLD', 52.2]]],
  ['COvSB F', [['4BET', 6.6], ['CALL', 57.9], ['FOLD', 35.5]]],
  ['COvJAM SB F', [['CALL', 84.6], ['FOLD', 15.4]]],
  ['COvBB F', [['4BET', 8.6], ['CALL', 40.1], ['FOLD', 51.3]]],
  ['COvJAM BB F', [['CALL', 82.4], ['FOLD', 17.6]]],
  ['BTNvSB F', [['4BET', 2.7], ['CALL', 33.6], ['FOLD', 63.7]]],
  ['BTNvJAM SB F', [['CALL', 100], ['FOLD', 0]]],
  ['BTNvBB F', [['4BET', 5.4], ['CALL', 41.7], ['FOLD', 52.9]]],
  ['BTNvJAM BB F', [['CALL', 100], ['FOLD', 0]]],
  ['SBvBB F', [['4BET', 6.2], ['CALL', 13.3], ['FOLD', 19.5]]],
  ['SBvJAM BB F', [['CALL', 100], ['FOLD', 0]]],
  ['OR BTNvF', [['RFI', 61.1], ['FOLD', 38.9]]],
  ['OR SBvF', [['RFI', 68], ['FOLD', 32]]],
] as const

const MAOS_FISH: Record<string, Record<string, Action>> = {
  'HJvUTG F': { 'AA': 'raise', '76s': 'raise', 'KQo': 'fold' },
  'HJv4B UTG F': { 'AA': 'jam', '76s': 'fold', 'KQo': 'out_of_range' },
  'COvUTG F': { 'AA': 'raise', '76s': 'raise', 'KQo': 'fold' },
  'COv4B UTG F': { 'AA': 'jam', '76s': 'fold', 'KQo': 'out_of_range' },
  'BTNvUTG F': { 'AA': 'raise', '76s': 'raise', 'KQo': 'fold' },
  'BTNv4B UTG F': { 'AA': 'jam', '76s': 'fold', 'KQo': 'out_of_range' },
  'COvHJ F': { 'AA': 'raise', '76s': 'raise', 'KQo': 'raise' },
  'COv4B HJ F': { 'AA': 'jam', '76s': 'fold', 'KQo': 'fold' },
  'BTNvHJ F': { 'AA': 'raise', '76s': 'raise', 'KQo': 'raise' },
  'BTNv4B HJ F': { 'AA': 'jam', '76s': 'fold', 'KQo': 'fold' },
  'BTNvCO F': { 'AA': 'raise', '76s': 'raise', 'KQo': 'raise' },
  'BTNv4B CO F': { 'AA': 'jam', '76s': 'fold', 'KQo': 'fold' },
  'BBvUTG F': { 'AA': 'raise', '76s': 'raise', 'KQo': 'call' },
  'BBv4B UTG F': { 'AA': 'jam', '76s': 'fold', 'KQo': 'out_of_range' },
  'BBvHJ F': { 'AA': 'raise', '76s': 'raise', 'KQo': 'call' },
  'BBv4B HJ F': { 'AA': 'jam', '76s': 'fold', 'KQo': 'out_of_range' },
  'BBvCO F': { 'AA': 'raise', '76s': 'raise', 'KQo': 'raise' },
  'BBv4B CO F': { 'AA': 'jam', '76s': 'fold', 'KQo': 'fold' },
  'BBvBTN F': { 'AA': 'raise', '76s': 'raise', 'KQo': 'raise' },
  'BBv4B BTN F': { 'AA': 'jam', '76s': 'fold', 'KQo': 'fold' },
  'BBvSB F': { 'AA': 'raise', '76s': 'call', 'KQo': 'raise' },
  'BBv4B SB F': { 'AA': 'jam', '76s': 'out_of_range', 'KQo': 'fold' },
  'SBvUTG F': { 'AA': 'raise', '76s': 'fold', 'KQo': 'fold' },
  'SBv4B UTG F': { 'AA': 'jam', '76s': 'out_of_range', 'KQo': 'out_of_range' },
  'SBvHJ F': { 'AA': 'raise', '76s': 'fold', 'KQo': 'raise' },
  'SBv4B HJ F': { 'AA': 'jam', '76s': 'out_of_range', 'KQo': 'fold' },
  'SBvCO F': { 'AA': 'raise', '76s': 'raise', 'KQo': 'raise' },
  'SBv4B CO F': { 'AA': 'jam', '76s': 'fold', 'KQo': 'fold' },
  'SBvBTN F': { 'AA': 'raise', '76s': 'raise', 'KQo': 'raise' },
  'SBv4B BTN F': { 'AA': 'jam', '76s': 'fold', 'KQo': 'fold' },
  'UTGvHJ F': { 'AA': 'raise', '76s': 'call', 'KQo': 'fold' },
  'UTGvJAM HJ F': { 'AA': 'call', '76s': 'out_of_range', 'KQo': 'out_of_range' },
  'UTGvCO F': { 'AA': 'raise', '76s': 'call', 'KQo': 'fold' },
  'UTGvJAM CO F': { 'AA': 'call', '76s': 'out_of_range', 'KQo': 'out_of_range' },
  'UTGvBTN F': { 'AA': 'raise', '76s': 'call', 'KQo': 'fold' },
  'UTGvJAM BTN F': { 'AA': 'call', '76s': 'out_of_range', 'KQo': 'out_of_range' },
  'UTGvSB F': { 'AA': 'raise', '76s': 'call', 'KQo': 'fold' },
  'UTGvJAM SB F': { 'AA': 'call', '76s': 'out_of_range', 'KQo': 'out_of_range' },
  'UTGvBB F': { 'AA': 'raise', '76s': 'call', 'KQo': 'fold' },
  'UTGvJAM BB F': { 'AA': 'call', '76s': 'out_of_range', 'KQo': 'out_of_range' },
  'HJvCO F': { 'AA': 'raise', '76s': 'call', 'KQo': 'fold' },
  'HJvJAM CO F': { 'AA': 'call', '76s': 'out_of_range', 'KQo': 'out_of_range' },
  'HJvBTN F': { 'AA': 'raise', '76s': 'call', 'KQo': 'fold' },
  'HJvJAM BTN F': { 'AA': 'call', '76s': 'out_of_range', 'KQo': 'out_of_range' },
  'HJvSB F': { 'AA': 'raise', '76s': 'call', 'KQo': 'fold' },
  'HJvJAM SB F': { 'AA': 'call', '76s': 'out_of_range', 'KQo': 'out_of_range' },
  'HJvBB F': { 'AA': 'raise', '76s': 'call', 'KQo': 'call' },
  'HJvJAM BB F': { 'AA': 'call', '76s': 'out_of_range', 'KQo': 'out_of_range' },
  'COvBTN F': { 'AA': 'raise', '76s': 'call', 'KQo': 'fold' },
  'COvJAM BTN F': { 'AA': 'call', '76s': 'out_of_range', 'KQo': 'out_of_range' },
  'COvSB F': { 'AA': 'raise', '76s': 'call', 'KQo': 'call' },
  'COvJAM SB F': { 'AA': 'call', '76s': 'out_of_range', 'KQo': 'out_of_range' },
  'COvBB F': { 'AA': 'raise', '76s': 'call', 'KQo': 'call' },
  'COvJAM BB F': { 'AA': 'call', '76s': 'out_of_range', 'KQo': 'out_of_range' },
  'BTNvSB F': { 'AA': 'raise', '76s': 'call', 'KQo': 'call' },
  'BTNvJAM SB F': { 'AA': 'call', '76s': 'out_of_range', 'KQo': 'out_of_range' },
  'BTNvBB F': { 'AA': 'raise', '76s': 'call', 'KQo': 'call' },
  'BTNvJAM BB F': { 'AA': 'call', '76s': 'out_of_range', 'KQo': 'out_of_range' },
  'SBvBB F': { 'AA': 'raise', '76s': 'call', 'KQo': 'fold' },
  'SBvJAM BB F': { 'AA': 'call', '76s': 'out_of_range', 'KQo': 'out_of_range' },
  'OR BTNvF': { 'AA': 'raise', '76s': 'raise', 'KQo': 'raise' },
  'OR SBvF': { 'AA': 'raise', '76s': 'raise', 'KQo': 'raise' },
}

// Rótulos que cada família usa na legenda contra fish, conferidos nas 62 abas. É a prova da regra
// que decide a família de "X vY F" pela posição: quem age depois de Y enfrenta um open (3bet, ou
// defesa do BB), e quem age antes enfrenta um 3bet. Cada família tem exatamente um conjunto.
const ROTULOS_FISH_POR_FAMILIA: Record<string, string[]> = {
  rfi: ['FOLD', 'RFI'],
  '3bet': ['3BET', 'FOLD'],
  'bb-defense': ['3BET', 'CALL', 'FOLD'],
  'vs-3bet': ['4BET', 'CALL', 'FOLD'],
  'vs-4bet': ['FOLD', 'JAM'],
  'vs-jam': ['CALL', 'FOLD'],
}

describe('contra fish: spots', () => {
  it('tem os 62 spots, um por aba: 2 de RFI, 10 de 3bet, 5 de defesa do BB, 15 de vs 3bet, 15 de vs 4bet e 15 de vs jam', () => {
    expect(contraFish).toHaveLength(62)
    const porFamilia = (f: SpotFamily) => contraFish.filter((s) => s.family === f).map((s) => s.sourceSheet).sort()
    for (const f of ['rfi', '3bet', 'bb-defense', 'vs-3bet', 'vs-4bet', 'vs-jam'] as const) {
      expect(porFamilia(f)).toEqual(SPOTS_FISH.filter((l) => l[1] === f).map((l) => l[0]).sort())
    }
    expect(['rfi', '3bet', 'bb-defense', 'vs-3bet', 'vs-4bet', 'vs-jam'].map((f) => porFamilia(f as SpotFamily).length)).toEqual([2, 10, 5, 15, 15, 15])
  })

  // O vilão é fish. No RFI contra fish (OR BTNvF e OR SBvF) não há posição de vilão.
  it.each(SPOTS_FISH)('a aba %s é da família %s, com Hero %s contra o fish em %s', (aba, familia, hero, vilao) => {
    const spot = spotDaAba(aba)
    expect(spot).toMatchObject({ family: familia, hero, villain: { type: 'fish', position: vilao } })
    const alvo = vilao === null ? '' : `-vs-${vilao}`
    expect(spot.id).toBe(`${familia}-${hero}${alvo}-fish`.toLowerCase())
  })

  it('não repete nenhum spot de regular: regular e fish somam 127 spots', () => {
    expect(contraRegular).toHaveLength(65)
    expect(dados.spots).toHaveLength(65 + 62)
  })

  it.each(Object.entries(ROTULOS_FISH_POR_FAMILIA))('na família %s, toda legenda contra fish traz exatamente os rótulos %j', (familia, rotulos) => {
    const violacoes = contraFish
      .filter((s) => s.family === familia)
      .filter((s) => s.legend.map((l) => l.label).sort().join() !== [...rotulos].sort().join())
      .map((s) => `${s.id}: legenda com ${s.legend.map((l) => l.label).join(', ')}`)
    expect(violacoes).toEqual([])
  })
})

describe('contra fish: mãos e legenda', () => {
  // [aba, mãos de raise, jam, call, fold e fora do range]. Contadas na planilha.
  it.each(CONTAGENS_FISH)('na aba %s há %i mãos de raise, %i de jam, %i de call, %i de fold e %i fora do range', (aba, r, j, c, f, fora) => {
    expect([
      contaMaos(aba, 'raise'), contaMaos(aba, 'jam'), contaMaos(aba, 'call'), contaMaos(aba, 'fold'), contaMaos(aba, 'out_of_range'),
    ]).toEqual([r, j, c, f, fora])
  })

  it.each(LEGENDAS_FISH)('a legenda da aba %s traz os rótulos e percentuais da planilha', (aba, entradas) => {
    expect(spotDaAba(aba).legend).toEqual(
      entradas.map(([label, percent]) => ({ label, action: ACAO_DO_ROTULO[label], percent })),
    )
  })

  const TODAS_AS_MAOS_FISH = Object.entries(MAOS_FISH).flatMap(([aba, maos]) =>
    Object.entries(maos).map(([nome, acao]) => [aba, nome, acao] as const),
  )
  it.each(TODAS_AS_MAOS_FISH)('na aba %s, %s é %s', (aba, nome, acao) => {
    expect(maoDaAba(aba, nome).action).toBe(acao)
  })

  // A planilha não traz EV nos spots contra fish.
  it('não tem EV em nenhuma mão', () => {
    const violacoes = contraFish.flatMap((s) =>
      s.hands.filter((h) => h.ev !== null).map((h) => `${s.id}: mão ${h.hand} tem EV ${h.ev}`),
    )
    expect(violacoes).toEqual([])
  })
})

describe('contra fish: sizings', () => {
  // As abas de fish só têm rótulos ("vs RFI UTG"), sem número. Os tamanhos do fish ficam na coluna
  // "vs FISH" da barra lateral das abas contra regular de cada Hero, e não conflitam entre abas.
  // Valem para o Hero, não para o spot: o UTG não tem coluna de fish em nenhuma aba.
  const FISH_DO_HERO = {
    UTG: { vs3bet: {}, vsOpen: {} },
    HJ: { vs3bet: {}, vsOpen: { UTG: 2.5 } },
    CO: { vs3bet: { SB: 10, BB: 11 }, vsOpen: { UTG: 2.5, HJ: 2.5 } },
    BTN: { vs3bet: { SB: 10, BB: 11 }, vsOpen: {} },
    SB: { vs3bet: { BB: 9 }, vsOpen: {} },
    BB: { vs3bet: {}, vsOpen: { UTG: 2.5, HJ: 2.5, CO: 2.5, BTN: 2 } },
  } as const

  it.each(SPOTS_FISH)('a aba %s traz os tamanhos que a coluna de fish do Hero %s mostra', (aba, _familia, hero) => {
    expect(spotDaAba(aba).sizings).toEqual(FISH_DO_HERO[hero])
  })

  it('não traz o tamanho do open, do 3bet nem do 4bet do próprio Hero, que a planilha não dá contra fish', () => {
    const violacoes = contraFish
      .filter((s) => s.sizings.open !== undefined || s.sizings.threeBet !== undefined || s.sizings.fourBet !== undefined || s.sizings.vs4bet !== undefined)
      .map((s) => s.id)
    expect(violacoes).toEqual([])
  })

  // Os tamanhos do fish são diferentes dos do regular (fish abre 2,5bb onde o regular abre 2bb).
  it('mostra o fish com tamanhos distintos do regular no mesmo Hero', () => {
    expect(spotDaAba('BBvUTG').sizings.vsOpen.UTG).toBe(2)
    expect(spotDaAba('BBvUTG F').sizings.vsOpen.UTG).toBe(2.5)
  })
})

// ---------------------------------------------------------------------------
// Inventário completo (ticket 7): nenhuma das 332 abas some sem registro.

const TOTAL_DE_ABAS = 332

describe('inventário das abas', () => {
  it('soma as 332 abas da planilha: as que viraram spot mais as que ficaram de fora', () => {
    expect(relatorio.totalSheets).toBe(TOTAL_DE_ABAS)
    expect(relatorio.imported.length + relatorio.excluded.length).toBe(TOTAL_DE_ABAS)
    expect(relatorio.imported).toHaveLength(127)
    expect(relatorio.excluded).toHaveLength(205)
  })

  it('não repete aba, nem entre as importadas e as excluídas', () => {
    const todas = [...relatorio.imported, ...relatorio.excluded.map((e) => e.sheet)]
    const repetidas = todas.filter((aba, i) => todas.indexOf(aba) !== i)
    expect(repetidas).toEqual([])
  })

  it('importa exatamente as abas que viraram spot no JSON, e nenhum spot vem de aba excluída', () => {
    expect([...relatorio.imported].sort()).toEqual(dados.spots.map((s) => s.sourceSheet).sort())
    const excluidas = new Set(relatorio.excluded.map((e) => e.sheet))
    expect(dados.spots.filter((s) => excluidas.has(s.sourceSheet)).map((s) => s.id)).toEqual([])
  })

  // Contagens por motivo, feitas por um script à parte a partir dos nomes das abas.
  it.each([
    ['3-handed', 6],
    ['heads-up', 5],
    ['squeeze', 50],
    ['cold 4bet', 120],
    ['variante de tamanho de aposta', 24],
  ] as const)('exclui %s em %i abas', (motivo, esperado) => {
    expect(relatorio.excluded.filter((e) => e.reason === motivo)).toHaveLength(esperado)
  })

  it('dá a cada aba excluída um motivo coerente com o nome dela', () => {
    const coerente = (aba: string, motivo: string) => {
      switch (motivo) {
        case '3-handed': return /^3H /.test(aba)
        case 'heads-up': return /^HU /.test(aba)
        case 'squeeze': return aba.includes('SQZ')
        case 'cold 4bet': return aba.includes('C4B')
        case 'variante de tamanho de aposta': return / \d+(\.\d+)?$/.test(aba)
        default: return false
      }
    }
    const violacoes = relatorio.excluded
      .filter((e) => !coerente(e.sheet, e.reason))
      .map((e) => `a aba "${e.sheet}" tem o motivo "${e.reason}"`)
    expect(violacoes).toEqual([])
  })

  // As variantes de tamanho são as abas de um spot da v1 com um número no fim do nome.
  it('lista as 24 variantes de tamanho de aposta, cada uma de um spot que a v1 já tem', () => {
    const variantes = relatorio.excluded.filter((e) => e.reason === 'variante de tamanho de aposta').map((e) => e.sheet)
    expect(variantes).toEqual([
      'BBvUTG 2.5', 'BBv4B UTG 2.5', 'BBvHJ 2.5', 'BBv4B HJ 2.5', 'BBvCO 2.5', 'BBv4B CO 2.5',
      'BBvBTN 2', 'BBv4B BTN 2', '3B HJvUTG 2.5', 'HJv4B UTG 2.5', '3B COvUTG 2.5', 'COv4B UTG 2.5',
      '3B COvHJ 2.5', 'COv4B HJ 2.5', 'COv3B SB 10', 'COv3B SB 10.1', 'COv3B BB 11', 'COv3B BB 11.1',
      'BTNv3B SB 10', 'BTNv3B SB 10.1', 'BTNv3B BB 11', 'BTNv3B BB 11.1', 'SBv3B BB 9', 'SBv3B BB 9.1',
    ])
    const importadas = new Set(relatorio.imported)
    const semBase = variantes.filter((aba) => !importadas.has(aba.replace(/ \d+(\.\d+)?$/, '')))
    expect(semBase).toEqual([])
  })

  it('lista as abas de 3-handed e de heads-up', () => {
    const por = (motivo: string) => relatorio.excluded.filter((e) => e.reason === motivo).map((e) => e.sheet)
    expect(por('3-handed')).toEqual(['3H UTG', '3H HJ', '3H CO', '3H BTN', '3H SB', '3H BB'])
    expect(por('heads-up')).toEqual(['HU SB 1', 'HU BB 1', 'HU SB 1.1', 'HU BB 1.1', 'HU SB 1.2'])
  })
})
