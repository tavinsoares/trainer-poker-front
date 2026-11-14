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
