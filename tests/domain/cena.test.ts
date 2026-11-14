import { describe, expect, it } from 'vitest'
import type { Question } from '../../src/domain/tipos.ts'
import { dados, perguntaDe } from './auxiliares.ts'

// Seam 1 da spec 2 (o sorteio), olhado pela cena que a pergunta descreve: tamanhos, pote,
// valor a pagar, assentos e botões. Roda contra o ranges.json real. Os valores de referência são
// os dos exemplos da spec, conferidos à mão nas abas (tamanhos) e somando o investido de cada assento.

const POSICOES = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']
const seat = (p: Question, posicao: string) => p.seats.find((s) => s.position === posicao)

// Uma mão qualquer do spot serve: a cena não depende da mão.
const cena = (spotId: string) => perguntaDe(spotId, 'AA')

describe('cena do RFI', () => {
  it('UTG: pote de 1,5bb, nada a pagar, open de 2bb no botão e todos os outros aguardando', () => {
    const p = cena('rfi-utg-regular')
    expect(p).toMatchObject({ stack: 100, pot: 1.5, toCall: null, history: [] })
    expect(p.options.find((o) => o.action === 'raise')).toEqual({ action: 'raise', label: 'Open', size: 2 })
    expect(p.seats.map((s) => [s.position, s.state])).toEqual([
      ['UTG', 'hero'], ['HJ', 'waiting'], ['CO', 'waiting'], ['BTN', 'waiting'], ['SB', 'waiting'], ['BB', 'waiting'],
    ])
  })

  it('BTN: quem está antes do Hero já foldou, e os blinds aguardam; open de 2,5bb', () => {
    const p = cena('rfi-btn-regular')
    expect(p.seats.map((s) => [s.position, s.state])).toEqual([
      ['UTG', 'folded'], ['HJ', 'folded'], ['CO', 'folded'], ['BTN', 'hero'], ['SB', 'waiting'], ['BB', 'waiting'],
    ])
    expect(p.options.find((o) => o.action === 'raise')).toMatchObject({ size: 2.5 })
  })
})

describe('cena do 3bet contra um open e da defesa do BB', () => {
  it('BBvBTN: o BTN abriu 2,5bb, pote de 4bb, 1,5bb a pagar e 3bet de 13bb no botão', () => {
    const p = cena('bb-defense-bb-vs-btn-regular')
    expect(p).toMatchObject({ stack: 100, pot: 4, toCall: 1.5 })
    expect(p.history).toEqual([{ position: 'BTN', action: 'open', size: 2.5, estimated: false }])
    expect(p.options).toEqual([
      { action: 'fold', label: 'Fold' },
      { action: 'call', label: 'Call' },
      { action: 'raise', label: '3bet', size: 13 },
    ])
  })

  it('3B COvUTG: o UTG abriu 2bb, pote de 3,5bb e 2bb a pagar; só os blinds aguardam', () => {
    const p = cena('3bet-co-vs-utg-regular')
    expect(p).toMatchObject({ pot: 3.5, toCall: 2 })
    expect(p.options.find((o) => o.action === 'raise')).toEqual({ action: 'raise', label: '3bet', size: 6.5 })
    expect(p.seats).toEqual([
      { position: 'UTG', state: 'acted', action: 'open', size: 2, estimated: false },
      { position: 'HJ', state: 'folded' },
      { position: 'CO', state: 'hero' },
      { position: 'BTN', state: 'waiting' },
      { position: 'SB', state: 'waiting' },
      { position: 'BB', state: 'waiting' },
    ])
  })

  it('3B SBvBTN: o SB já tem 0,5bb investido, então o pote é de 4bb e o valor a pagar, de 2bb', () => {
    const p = cena('3bet-sb-vs-btn-regular')
    expect(p).toMatchObject({ pot: 4, toCall: 2 })
    expect(p.options.find((o) => o.action === 'raise')).toMatchObject({ size: 12 })
    expect(seat(p, 'BB')).toEqual({ position: 'BB', state: 'waiting' })
    expect(seat(p, 'UTG')).toEqual({ position: 'UTG', state: 'folded' })
  })

  it('os 15 spots (10 de 3bet e 5 de defesa do BB) geram perguntas completas, em todas as mãos', () => {
    const spots = dados.spots.filter((s) => ['3bet', 'bb-defense'].includes(s.family) && s.villain.type === 'regular')
    expect(spots).toHaveLength(15)
    const violacoes = spots.flatMap((s) =>
      s.hands.filter((h) => h.action !== 'out_of_range').flatMap((h) => {
        const p = perguntaDe(s.id, h.hand)
        const raise = p.options.find((o) => o.action === 'raise')
        return [
          ...(p.seats.map((x) => x.position).join() === POSICOES.join() ? [] : [`${s.id}: assentos fora de ordem`]),
          ...(p.seats.filter((x) => x.state === 'hero').length === 1 ? [] : [`${s.id}: não há um Hero só`]),
          ...(p.history.length === 1 && p.history[0]!.position === s.villain.position ? [] : [`${s.id}: sem o open do vilão`]),
          ...(Number.isFinite(p.pot) && p.pot > 0 && p.toCall !== null && p.toCall > 0 ? [] : [`${s.id}: pote ou valor a pagar inválido`]),
          ...(raise?.size !== undefined && raise.size > 0 && p.stack === 100 ? [] : [`${s.id}: sem o tamanho do 3bet`]),
        ].map((m) => `${m} (mão ${h.hand})`)
      }),
    )
    expect([...new Set(violacoes)]).toEqual([])
  })
})

describe('cena de enfrentar agressão', () => {
  it('vs 3bet, UTGv3B BB: o UTG abriu 2bb e o BB deu 3bet de 12bb; pote de 14,5bb, 10bb a pagar e 4bet de 22bb', () => {
    const p = cena('vs-3bet-utg-vs-bb-regular')
    expect(p).toMatchObject({ pot: 14.5, toCall: 10 })
    expect(p.history).toEqual([
      { position: 'UTG', action: 'open', size: 2, estimated: false },
      { position: 'BB', action: '3bet', size: 12, estimated: false },
    ])
    expect(p.options).toEqual([
      { action: 'fold', label: 'Fold' },
      { action: 'call', label: 'Call' },
      { action: 'raise', label: '4bet', size: 22 },
    ])
    // Quem não participa da mão aparece como foldou, e o BB mostra o 3bet.
    expect(p.seats).toEqual([
      { position: 'UTG', state: 'hero' },
      { position: 'HJ', state: 'folded' },
      { position: 'CO', state: 'folded' },
      { position: 'BTN', state: 'folded' },
      { position: 'SB', state: 'folded' },
      { position: 'BB', state: 'acted', action: '3bet', size: 12, estimated: false },
    ])
  })

  it('vs 4bet, BBv4B BTN: open de 2,5bb, 3bet de 13bb e 4bet de 27bb; pote de 40,5bb, 14bb a pagar, jam no botão', () => {
    const p = cena('vs-4bet-bb-vs-btn-regular')
    expect(p).toMatchObject({ pot: 40.5, toCall: 14 })
    expect(p.history).toEqual([
      { position: 'BTN', action: 'open', size: 2.5, estimated: false },
      { position: 'BB', action: '3bet', size: 13, estimated: false },
      { position: 'BTN', action: '4bet', size: 27, estimated: false },
    ])
    expect(p.options).toEqual([
      { action: 'fold', label: 'Fold' },
      { action: 'call', label: 'Call' },
      { action: 'jam', label: 'Jam', size: 100 },
    ])
    // O BTN mostra a última aposta (o 4bet), e o SB, que não participa, foldou.
    expect(seat(p, 'BTN')).toEqual({ position: 'BTN', state: 'acted', action: '4bet', size: 27, estimated: false })
    expect(seat(p, 'SB')).toEqual({ position: 'SB', state: 'folded' })
  })

  it('vs jam, BTNvJAM BB: o BTN abriu 2,5bb e o BB deu jam de 100bb; pote de 103bb, 97,5bb a pagar, só fold e call', () => {
    const p = cena('vs-jam-btn-vs-bb-regular')
    expect(p).toMatchObject({ pot: 103, toCall: 97.5 })
    expect(p.history).toEqual([
      { position: 'BTN', action: 'open', size: 2.5, estimated: false },
      { position: 'BB', action: 'jam', size: 100, estimated: false },
    ])
    expect(p.options).toEqual([
      { action: 'fold', label: 'Fold' },
      { action: 'call', label: 'Call' },
    ])
  })

  // O jam só é oferecido no vs 3bet quando alguma mão do spot é jam: só o MPv3B CO. O SBv3B BB tem
  // JAM na legenda, mas nenhuma mão com essa cor (duas inconsistências conhecidas da planilha).
  it('vs 3bet oferece o jam só no HJ contra o 3bet do CO, o único spot com mãos de jam', () => {
    const comJam = dados.spots.filter((s) => s.family === 'vs-3bet' && s.villain.type === 'regular')
      .filter((s) => perguntaDe(s.id, s.hands.find((h) => h.action !== 'out_of_range')!.hand).options.some((o) => o.action === 'jam'))
      .map((s) => s.id)
    expect(comJam).toEqual(['vs-3bet-hj-vs-co-regular'])
    expect(cena('vs-3bet-hj-vs-co-regular').options).toEqual([
      { action: 'fold', label: 'Fold' },
      { action: 'call', label: 'Call' },
      { action: 'raise', label: '4bet', size: 19 },
      { action: 'jam', label: 'Jam', size: 100 },
    ])
  })

  it('os 45 spots de vs 3bet, vs 4bet e vs jam geram perguntas completas, em todas as mãos que chegam ao spot', () => {
    const familias = ['vs-3bet', 'vs-4bet', 'vs-jam']
    const spots = dados.spots.filter((s) => familias.includes(s.family) && s.villain.type === 'regular')
    expect(spots).toHaveLength(45)
    const violacoes = spots.flatMap((s) =>
      s.hands.filter((h) => h.action !== 'out_of_range').flatMap((h) => {
        const p = perguntaDe(s.id, h.hand)
        const ultima = p.history[p.history.length - 1]
        return [
          ...(p.seats.filter((x) => x.state === 'hero').length === 1 ? [] : ['não há um Hero só']),
          ...(p.seats.every((x) => x.state !== 'waiting') ? [] : ['há assento aguardando']),
          ...(ultima?.position === s.villain.position ? [] : ['a última aposta não é do vilão']),
          ...(Number.isFinite(p.pot) && p.pot > 0 && p.toCall !== null && p.toCall > 0 ? [] : ['pote ou valor a pagar inválido']),
          ...(p.options.every((o) => (o.action === 'raise' || o.action === 'jam') === (o.size !== undefined)) ? [] : ['tamanho só no raise e no jam']),
        ].map((m) => `${s.id}: ${m} (mão ${h.hand})`)
      }),
    )
    expect([...new Set(violacoes)]).toEqual([])
  })
})

describe('cena contra fish', () => {
  // Os tamanhos que a planilha traz para o fish valem como estão; os que faltam vêm do spot
  // equivalente contra regular e ficam marcados como estimados.
  it('traz o selo do fish, e o RFI contra fish não tem posição de vilão', () => {
    const p = cena('rfi-btn-fish')
    expect(p.spot.villain).toEqual({ type: 'fish', position: null })
    expect(p.pot).toBe(1.5)
    expect(p.toCall).toBeNull()
    // A planilha não dá o open do Hero contra fish: vem do RFI regular do BTN (2,5bb), estimado.
    expect(p.options.find((o) => o.action === 'raise')).toEqual({ action: 'raise', label: 'Open', size: 2.5, estimated: true })
    expect(p.seats.map((s) => [s.position, s.state])).toEqual([
      ['UTG', 'folded'], ['HJ', 'folded'], ['CO', 'folded'], ['BTN', 'hero'], ['SB', 'waiting'], ['BB', 'waiting'],
    ])
  })

  it('usa o open do fish que a planilha traz (2,5bb do UTG) sem marca, e estima o 3bet do Hero (6,5bb do regular)', () => {
    const p = cena('3bet-co-vs-utg-fish')
    expect(p.history).toEqual([{ position: 'UTG', action: 'open', size: 2.5, estimated: false }])
    expect(p).toMatchObject({ pot: 4, toCall: 2.5 })
    expect(p.options.find((o) => o.action === 'raise')).toEqual({ action: 'raise', label: '3bet', size: 6.5, estimated: true })
  })

  it('estima o open do UTG (2bb do regular) quando a planilha não o traz para o fish, e marca o assento', () => {
    const p = cena('3bet-btn-vs-utg-fish')
    expect(p.history).toEqual([{ position: 'UTG', action: 'open', size: 2, estimated: true }])
    expect(seat(p, 'UTG')).toEqual({ position: 'UTG', state: 'acted', action: 'open', size: 2, estimated: true })
    expect(p).toMatchObject({ pot: 3.5, toCall: 2 })
    expect(p.options.find((o) => o.action === 'raise')).toMatchObject({ size: 7.5, estimated: true })
  })

  it('um spot do UTG contra fish, sem nenhum tamanho próprio, tem todos os tamanhos estimados', () => {
    const p = cena('vs-3bet-utg-vs-bb-fish')
    expect(p.history).toEqual([
      { position: 'UTG', action: 'open', size: 2, estimated: true },
      { position: 'BB', action: '3bet', size: 12, estimated: true },
    ])
    expect(p).toMatchObject({ pot: 14.5, toCall: 10 })
    expect(p.options.find((o) => o.action === 'raise')).toEqual({ action: 'raise', label: '4bet', size: 22, estimated: true })
  })

  it('segue os botões da família: vs 4bet contra fish oferece fold, call e jam, mesmo sem nenhuma mão de call', () => {
    const spot = dados.spots.find((s) => s.id === 'vs-4bet-bb-vs-btn-fish')!
    expect(spot.hands.some((h) => h.action === 'call')).toBe(false)
    expect(cena('vs-4bet-bb-vs-btn-fish').options.map((o) => o.action)).toEqual(['fold', 'call', 'jam'])
  })

  it('as 127 abas da v1 geram perguntas completas, em todas as mãos que chegam ao spot', () => {
    expect(dados.spots).toHaveLength(127)
    const violacoes = dados.spots.flatMap((s) =>
      s.hands.filter((h) => h.action !== 'out_of_range').flatMap((h) => {
        const p = perguntaDe(s.id, h.hand)
        const rfi = s.family === 'rfi'
        return [
          ...(p.spot.villain.type === s.villain.type ? [] : ['selo do vilão errado']),
          ...(p.seats.length === 6 && p.seats.filter((x) => x.state === 'hero').length === 1 ? [] : ['assentos inválidos']),
          ...(Number.isFinite(p.pot) && p.pot >= 1.5 ? [] : ['pote inválido']),
          ...(rfi ? (p.toCall === null ? [] : ['RFI com valor a pagar']) : p.toCall !== null && p.toCall > 0 ? [] : ['sem valor a pagar']),
          ...(p.history.every((b) => Number.isFinite(b.size) && b.size > 0) ? [] : ['aposta sem tamanho']),
          ...(p.options.every((o) => (o.action === 'raise' || o.action === 'jam') === (o.size !== undefined)) ? [] : ['tamanho só no raise e no jam']),
          ...(s.villain.type === 'regular' && JSON.stringify(p).includes('"estimated":true') ? ['estimado contra regular'] : []),
        ].map((m) => `${s.id}: ${m} (mão ${h.hand})`)
      }),
    )
    expect([...new Set(violacoes)]).toEqual([])
  })
})
