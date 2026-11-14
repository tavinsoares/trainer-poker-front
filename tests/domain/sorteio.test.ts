import { describe, expect, it } from 'vitest'
import type { RangesData } from '../../src/data/ranges-types.ts'
import { sortearPergunta } from '../../src/domain/sorteio.ts'
import { amostra, constante, dados } from './auxiliares.ts'

// Seam 1 da spec 2: o sorteio (dados e rng → pergunta). Roda contra o ranges.json real.

// Só o RFI do UTG, com as mãos de fold pintadas de cinza (fora do range) por este teste: as abas
// de RFI reais não têm cinza, e a regra "mão fora do range nunca sai" precisa de um spot que tenha.
const dadosComForaDoRange: RangesData = {
  ...dados,
  spots: dados.spots
    .filter((s) => s.id === 'rfi-utg-regular')
    .map((s) => ({
      ...s,
      hands: s.hands.map((h) => (h.action === 'fold' ? { ...h, action: 'out_of_range' as const } : h)),
    })),
}

// Só os cinco RFI, na ordem do JSON: os testes de rng constante dependem da lista de spots, e
// esta lista não muda quando outras famílias entram no sorteio.
const soRfi: RangesData = { ...dados, spots: dados.spots.filter((s) => s.family === 'rfi' && s.villain.type === 'regular') }

describe('sorteio', () => {
  // Valores de referência lidos no JSON por um script à parte: os cinco RFI contra regular
  // vêm na ordem UTG, HJ, CO, BTN, SB, e cada um tem 1326 combos (nenhuma mão fora do range).
  it('com rng 0 sorteia a primeira combinação do primeiro spot: AA de espadas e copas no UTG', () => {
    const pergunta = sortearPergunta(soRfi, constante(0))
    expect(pergunta.spot).toMatchObject({
      id: 'rfi-utg-regular',
      family: 'rfi',
      hero: 'UTG',
      villain: { type: 'regular', position: null },
    })
    expect(pergunta.hand).toEqual({
      name: 'AA',
      cards: [
        { rank: 'A', suit: 's' },
        { rank: 'A', suit: 'h' },
      ],
    })
  })

  it('com rng quase 1 sorteia a última combinação do último spot: 22 de ouros e paus no SB', () => {
    const pergunta = sortearPergunta(soRfi, constante(0.99999))
    expect(pergunta.spot.id).toBe('rfi-sb-regular')
    expect(pergunta.hand).toEqual({
      name: '22',
      cards: [
        { rank: '2', suit: 'd' },
        { rank: '2', suit: 'c' },
      ],
    })
  })

  // 0,5 × 1326 combos = a combinação 663 do CO, que cai em A6o (fold), na 8ª das 12 combinações
  // (ordem: a carta mais alta em espadas, copas, ouros, paus, cada uma com as outras três).
  it('com rng 0,5 sorteia pelo peso dos combos: A6o de ouros e 6 de copas no CO', () => {
    const pergunta = sortearPergunta(soRfi, constante(0.5))
    expect(pergunta.spot.id).toBe('rfi-co-regular')
    expect(pergunta.hand).toEqual({
      name: 'A6o',
      cards: [
        { rank: 'A', suit: 'd' },
        { rank: '6', suit: 'h' },
      ],
    })
  })

  // Quase 1: o último spot, a última mão, e a combinação 1324 de 1326 (a 5ª das 6 do par: copas e paus).
  it('com rng 0,999 sorteia o SB e a 22 de copas e paus, sem passar do fim', () => {
    const pergunta = sortearPergunta(soRfi, constante(0.999))
    expect(pergunta.spot.id).toBe('rfi-sb-regular')
    expect(pergunta.hand).toEqual({
      name: '22',
      cards: [
        { rank: '2', suit: 'h' },
        { rank: '2', suit: 'c' },
      ],
    })
  })

  it('sorteia mãos de fold (as azuis), porque o fold se treina com mãos que chegam ao spot', () => {
    const naPlanilha = (id: string, mao: string) =>
      dados.spots.find((s) => s.id === id)!.hands.find((h) => h.hand === mao)!.action
    const folds = amostra(2000, 1).filter((p) => naPlanilha(p.spot.id, p.hand.name) === 'fold')
    // O UTG, o HJ e o CO foldam mais da metade das combinações, então sobra muito fold na amostra.
    expect(folds.length).toBeGreaterThan(500)
  })

  // Par vale 6 combos, suited 4 e offsuit 12, de 1326 no total (definição do baralho).
  const COMBOS = (nome: string) => (nome.length === 2 ? 6 : nome.endsWith('s') ? 4 : 12)
  const soUtg: RangesData = { ...dados, spots: dados.spots.filter((s) => s.id === 'rfi-utg-regular') }
  const utg = amostra(300_000, 3, soUtg)

  it('sorteia cada uma das 169 classes na proporção dos combos (no UTG)', () => {
    const vezes = new Map<string, number>()
    for (const { hand } of utg) vezes.set(hand.name, (vezes.get(hand.name) ?? 0) + 1)
    const violacoes = dados.spots[0]!.hands.flatMap(({ hand }) => {
      const esperado = (utg.length * COMBOS(hand)) / 1326
      const real = vezes.get(hand) ?? 0
      // Cinco desvios-padrão de uma binomial.
      return Math.abs(real - esperado) < 5 * Math.sqrt(esperado)
        ? []
        : [`rfi-utg-regular: ${hand} saiu ${real} vezes, esperado ${esperado.toFixed(0)}`]
    })
    expect(violacoes).toEqual([])
  })

  it('dá naipes válidos, com a carta mais alta primeiro, e usa todas as combinações de cada classe', () => {
    const vistas = new Map<string, Set<string>>()
    const violacoes: string[] = []
    for (const { spot, hand } of utg) {
      const [alta, baixa] = hand.cards
      const onde = `${spot.id}: ${hand.name}`
      if (alta.rank !== hand.name[0] || baixa.rank !== hand.name[1]) violacoes.push(`${onde} com ranks fora de ordem`)
      if (hand.name.endsWith('s') !== (alta.suit === baixa.suit) && hand.name.length === 3) {
        violacoes.push(`${onde} com naipes inválidos para o tipo`)
      }
      if (hand.name.length === 2 && alta.suit === baixa.suit) violacoes.push(`${onde} é um par com o mesmo naipe`)
      const combinacoes = vistas.get(hand.name) ?? new Set<string>()
      combinacoes.add(alta.suit + baixa.suit)
      vistas.set(hand.name, combinacoes)
    }
    // Todas as combinações de naipes aparecem: par 6, suited 4, offsuit 12.
    for (const [nome, combinacoes] of vistas) {
      if (combinacoes.size !== COMBOS(nome)) {
        violacoes.push(`rfi-utg-regular: ${nome} usou ${combinacoes.size} combinações de naipes, esperado ${COMBOS(nome)}`)
      }
    }
    expect(vistas.size).toBe(169)
    expect(violacoes).toEqual([])
  })

  it('descreve o RFI com pote de 1,5bb e os botões Fold e Open (raise, com o tamanho do open)', () => {
    for (const pergunta of amostra(50, 5, soRfi)) {
      expect(pergunta.pot).toBe(1.5)
      expect(pergunta.options.map((o) => [o.action, o.label])).toEqual([['fold', 'Fold'], ['raise', 'Open']])
    }
  })

  it('sorteia os 127 spots da v1, contra regular e contra fish', () => {
    const sorteados = new Set(amostra(40_000, 6).map((p) => p.spot.id))
    expect(sorteados.size).toBe(127)
    expect([...sorteados].sort()).toEqual(dados.spots.map((s) => s.id).sort())
    expect([...new Set(amostra(2000, 6).map((p) => p.spot.villain.type))].sort()).toEqual(['fish', 'regular'])
  })

  it('nunca sorteia mão fora do range', () => {
    const foraDoRange = new Set(
      dados.spots.find((s) => s.id === 'rfi-utg-regular')!.hands.filter((h) => h.action === 'fold').map((h) => h.hand),
    )
    const sorteadas = amostra(5000, 2, dadosComForaDoRange)
    expect(sorteadas.filter((p) => foraDoRange.has(p.hand.name)).map((p) => `${p.spot.id}: ${p.hand.name}`)).toEqual([])
    expect(new Set(sorteadas.map((p) => p.hand.name)).has('AA')).toBe(true) // as de dentro continuam saindo
  })
})
