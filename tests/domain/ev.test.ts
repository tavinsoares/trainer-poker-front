import { describe, expect, it } from 'vitest'
import { avaliar } from '../../src/domain/avaliacao.ts'
import { dados, perguntaDe } from './auxiliares.ts'

// Seam 2 da spec 2 (a avaliação), olhado pelo EV: o da ação certa, o deixado na mesa e a mão de
// borda. Valores de referência lidos na planilha: AA do UTG com EV 10,32, KQo da defesa do BB
// contra o UTG com 0,47, T9s do UTG com 0 e AJo do BBv4B SB, que é fold, com 4,03.

const veredito = (spot: string, mao: string, escolhida: Parameters<typeof avaliar>[2]) =>
  avaliar(dados, perguntaDe(spot, mao), escolhida)

describe('EV da ação certa', () => {
  it('é o EV da mão quando a ação certa é raise, call ou jam e a planilha o traz', () => {
    expect(veredito('rfi-utg-regular', 'AA', 'raise')).toMatchObject({ ev: 10.32, correct: true })
    expect(veredito('bb-defense-bb-vs-utg-regular', 'KQo', 'call')).toMatchObject({ ev: 0.47, correctAction: 'call' })
    // O EV vem do spot e da mão, e não da ação escolhida.
    expect(veredito('rfi-utg-regular', 'AA', 'fold')).toMatchObject({ ev: 10.32, correct: false })
  })

  it('zero é um EV de verdade: T9s do UTG abre com EV 0', () => {
    expect(veredito('rfi-utg-regular', 'T9s', 'raise')).toMatchObject({ ev: 0, evLeft: null })
  })

  it('é ausente quando a planilha não o traz (mão de borda) e contra fish', () => {
    expect(veredito('rfi-utg-regular', 'A2s', 'raise').ev).toBeNull()
    expect(veredito('rfi-btn-fish', 'AA', 'raise').ev).toBeNull()
  })

  it('é ausente quando a ação certa é fold, mesmo que a planilha escreva EV na mão', () => {
    expect(dados.spots.find((s) => s.id === 'vs-4bet-bb-vs-sb-regular')!.hands.find((h) => h.hand === 'AJo')).toMatchObject({
      action: 'fold',
      ev: 4.03,
    })
    expect(veredito('vs-4bet-bb-vs-sb-regular', 'AJo', 'fold')).toMatchObject({ correct: true, ev: null, evLeft: null })
    expect(veredito('rfi-utg-regular', 'K8s', 'fold')).toMatchObject({ correct: true, ev: null })
  })
})

describe('EV deixado na mesa', () => {
  it('é o EV da ação certa quando o aluno dá fold numa mão de ação com EV positivo', () => {
    expect(veredito('rfi-utg-regular', 'AA', 'fold')).toMatchObject({ correct: false, evLeft: 10.32 })
    expect(veredito('bb-defense-bb-vs-utg-regular', 'KQo', 'fold')).toMatchObject({ correct: false, evLeft: 0.47 })
  })

  it('é ausente em qualquer outro erro: call ou raise errado, fold sem EV, fold com EV zero, e contra fish', () => {
    expect(veredito('bb-defense-bb-vs-utg-regular', 'KQo', 'raise').evLeft).toBeNull() // call certo, raise errado
    expect(veredito('rfi-utg-regular', 'K8s', 'raise').evLeft).toBeNull() // fold certo, raise errado
    expect(veredito('rfi-utg-regular', 'A2s', 'fold')).toMatchObject({ correct: false, evLeft: null }) // mão de borda, sem EV
    expect(veredito('rfi-utg-regular', 'T9s', 'fold')).toMatchObject({ correct: false, evLeft: null }) // EV zero
    expect(veredito('rfi-btn-fish', 'AA', 'fold')).toMatchObject({ correct: false, evLeft: null }) // fish
  })

  it('é ausente no fold correto, mesmo numa mão de fold com EV positivo (AJo do BBv4B SB)', () => {
    expect(veredito('vs-4bet-bb-vs-sb-regular', 'AJo', 'fold').evLeft).toBeNull()
    expect(veredito('vs-4bet-bb-vs-sb-regular', 'AJo', 'call')).toMatchObject({ correct: false, ev: null, evLeft: null })
  })
})

describe('mão de borda', () => {
  it('marca a mão de ação sem EV contra regular, e só ela', () => {
    expect(veredito('rfi-utg-regular', 'A2s', 'raise').edgeHand).toBe(true) // sem EV
    expect(veredito('rfi-utg-regular', 'AA', 'raise').edgeHand).toBe(false) // com EV
    expect(veredito('rfi-utg-regular', 'K8s', 'fold').edgeHand).toBe(false) // fold
    expect(veredito('rfi-btn-fish', 'AA', 'raise').edgeHand).toBe(false) // fish
  })

  it('não muda a pontuação: a mão de borda continua pela cor', () => {
    expect(veredito('rfi-utg-regular', 'A2s', 'raise')).toMatchObject({ correct: true, correctAction: 'raise' })
    expect(veredito('rfi-utg-regular', 'A2s', 'fold')).toMatchObject({ correct: false, correctAction: 'raise' })
  })
})

describe('veredito', () => {
  it('traz o tipo de vilão do spot', () => {
    expect(veredito('rfi-utg-regular', 'AA', 'raise').villainType).toBe('regular')
    expect(veredito('rfi-btn-fish', 'AA', 'raise').villainType).toBe('fish')
  })

  // Varredura de todos os spots e mãos, nomeando o spot e a mão que violam a regra. A regra vem
  // da spec, e a mão da planilha é a fonte (ação e EV).
  it('em todas as 127 abas, só a ação da planilha é correta e o EV segue as regras', () => {
    const violacoes: string[] = []
    let conferidas = 0
    for (const spot of dados.spots) {
      for (const mao of spot.hands.filter((h) => h.action !== 'out_of_range')) {
        const p = perguntaDe(spot.id, mao.hand)
        if (!p.options.some((o) => o.action === mao.action)) violacoes.push(`${spot.id}: ${mao.hand} sem botão para ${mao.action}`)
        for (const { action } of p.options) {
          conferidas++
          const v = avaliar(dados, p, action)
          const onde = `${spot.id}: ${mao.hand} com ${action}`
          if (v.correct !== (action === mao.action)) violacoes.push(`${onde}: pontuação errada`)
          const evEsperado = mao.action !== 'fold' ? mao.ev : null
          if (v.ev !== evEsperado) violacoes.push(`${onde}: EV ${v.ev}, esperado ${evEsperado}`)
          const deixouEsperado =
            action === 'fold' && mao.action !== 'fold' && spot.villain.type === 'regular' && mao.ev !== null && mao.ev > 0 ? mao.ev : null
          if (v.evLeft !== deixouEsperado) violacoes.push(`${onde}: EV deixado ${v.evLeft}, esperado ${deixouEsperado}`)
          const borda = spot.villain.type === 'regular' && mao.action !== 'fold' && mao.ev === null
          if (v.edgeHand !== borda) violacoes.push(`${onde}: borda ${v.edgeHand}, esperado ${borda}`)
          if (v.villainType !== spot.villain.type) violacoes.push(`${onde}: tipo de vilão errado`)
        }
      }
    }
    expect(violacoes).toEqual([])
    expect(conferidas).toBeGreaterThan(20_000) // 127 spots, cerca de 100 mãos que chegam ao spot em média, 2 a 4 botões
  })
})
