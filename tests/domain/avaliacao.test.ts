import { describe, expect, it } from 'vitest'
import { avaliar } from '../../src/domain/avaliacao.ts'
import { dados, perguntaDe } from './auxiliares.ts'

// Seam 2 da spec 2: a avaliação (dados, pergunta e ação escolhida → veredito).
// Roda contra o ranges.json real. As perguntas vêm do sorteio, com o rng roteirizado.
const pergunta = perguntaDe

describe('avaliação', () => {
  // Conferidos na planilha (aba RFI UTG): AA abre e K8s é fold.
  it('dá correto quando a ação escolhida é a da planilha, e traz a ação certa e a escolhida', () => {
    expect(avaliar(dados, pergunta('rfi-utg-regular', 'AA'), 'raise')).toMatchObject({
      correct: true,
      correctAction: 'raise',
      chosenAction: 'raise',
    })
    expect(avaliar(dados, pergunta('rfi-utg-regular', 'K8s'), 'fold')).toMatchObject({
      correct: true,
      correctAction: 'fold',
      chosenAction: 'fold',
    })
  })

  // Varredura: as 5 abas × 169 mãos, cada ação oferecida. A ação certa é a da mão no JSON
  // (a definição da spec), e uma violação nomeia o spot e a mão.
  it('em todas as 845 combinações de spot e mão, só a ação da planilha é correta', () => {
    const rfi = dados.spots.filter((s) => s.family === 'rfi' && s.villain.type === 'regular')
    const violacoes: string[] = []
    let conferidas = 0
    for (const spot of rfi) {
      for (const mao of spot.hands) {
        const p = pergunta(spot.id, mao.hand)
        for (const { action } of p.options) {
          conferidas++
          const veredito = avaliar(dados, p, action)
          if (veredito.correct !== (action === mao.action)) {
            violacoes.push(`${spot.id}: ${mao.hand} com ${action} deveria ser ${action === mao.action ? 'correto' : 'erro'}`)
          }
        }
      }
    }
    expect(violacoes).toEqual([])
    expect(conferidas).toBe(845 * 2)
  })

  // Na aba 3B COvUTG, AA é 3bet (EV 15,71), 76s é fold e nenhuma mão é call (conferido na planilha).
  it('no 3bet, call numa mão de 3bet é erro, e o 3bet em mão de fold também', () => {
    expect(avaliar(dados, pergunta('3bet-co-vs-utg-regular', 'AA'), 'call')).toMatchObject({ correct: false, correctAction: 'raise' })
    expect(avaliar(dados, pergunta('3bet-co-vs-utg-regular', 'AA'), 'raise')).toMatchObject({ correct: true })
    expect(avaliar(dados, pergunta('3bet-co-vs-utg-regular', '76s'), 'raise')).toMatchObject({ correct: false, correctAction: 'fold' })
  })

  // Na defesa do BB, KQo contra o UTG é call (EV 0,47) e 76s é 3bet.
  it('na defesa do BB, o call vale numa mão de call, e o fold nela é erro', () => {
    expect(avaliar(dados, pergunta('bb-defense-bb-vs-utg-regular', 'KQo'), 'call')).toMatchObject({ correct: true })
    expect(avaliar(dados, pergunta('bb-defense-bb-vs-utg-regular', 'KQo'), 'fold')).toMatchObject({ correct: false, correctAction: 'call' })
    expect(avaliar(dados, pergunta('bb-defense-bb-vs-utg-regular', '76s'), 'raise')).toMatchObject({ correct: true })
  })

  it('nos 15 spots de 3bet e defesa do BB, só a ação da planilha é correta, em todas as mãos', () => {
    const spots = dados.spots.filter((s) => ['3bet', 'bb-defense'].includes(s.family) && s.villain.type === 'regular')
    const violacoes: string[] = []
    let conferidas = 0
    for (const spot of spots) {
      for (const mao of spot.hands) {
        const p = pergunta(spot.id, mao.hand)
        for (const { action } of p.options) {
          conferidas++
          if (avaliar(dados, p, action).correct !== (action === mao.action)) {
            violacoes.push(`${spot.id}: ${mao.hand} com ${action} deveria ser ${action === mao.action ? 'correto' : 'erro'}`)
          }
        }
      }
    }
    expect(violacoes).toEqual([])
    expect(conferidas).toBe(15 * 169 * 3) // fold, call e 3bet em cada mão
  })

  // Ao enfrentar agressão: na aba BBv4B BTN, AA é jam (EV 63,69); no BTNvJAM BB, AA é call (EV 95,19) e Q9s é fold.
  it('vs 4bet e vs jam: o call em mão de jam é erro, e o call em mão de fold também', () => {
    expect(avaliar(dados, pergunta('vs-4bet-bb-vs-btn-regular', 'AA'), 'jam')).toMatchObject({ correct: true })
    expect(avaliar(dados, pergunta('vs-4bet-bb-vs-btn-regular', 'AA'), 'call')).toMatchObject({ correct: false, correctAction: 'jam' })
    expect(avaliar(dados, pergunta('vs-jam-btn-vs-bb-regular', 'Q9s'), 'call')).toMatchObject({ correct: false, correctAction: 'fold' })
  })

  it('nos 45 spots de vs 3bet, vs 4bet e vs jam, só a ação da planilha é correta, em todas as mãos que chegam ao spot', () => {
    const familias = ['vs-3bet', 'vs-4bet', 'vs-jam']
    const spots = dados.spots.filter((s) => familias.includes(s.family) && s.villain.type === 'regular')
    const violacoes: string[] = []
    let conferidas = 0
    for (const spot of spots) {
      for (const mao of spot.hands.filter((h) => h.action !== 'out_of_range')) {
        const p = pergunta(spot.id, mao.hand)
        // A ação da planilha precisa estar entre os botões, senão a mão não teria resposta certa.
        if (!p.options.some((o) => o.action === mao.action)) {
          violacoes.push(`${spot.id}: a ação ${mao.action} de ${mao.hand} não tem botão`)
        }
        for (const { action } of p.options) {
          conferidas++
          if (avaliar(dados, p, action).correct !== (action === mao.action)) {
            violacoes.push(`${spot.id}: ${mao.hand} com ${action} deveria ser ${action === mao.action ? 'correto' : 'erro'}`)
          }
        }
      }
    }
    expect(violacoes).toEqual([])
    expect(conferidas).toBeGreaterThan(4000) // 45 spots, cerca de 100 mãos que chegam ao spot em média, 2 ou 3 botões
  })

  it('dá erro em qualquer outra ação, e ainda diz qual era a certa', () => {
    expect(avaliar(dados, pergunta('rfi-utg-regular', 'AA'), 'fold')).toMatchObject({
      correct: false,
      correctAction: 'raise',
      chosenAction: 'fold',
    })
    expect(avaliar(dados, pergunta('rfi-utg-regular', 'K8s'), 'raise')).toMatchObject({
      correct: false,
      correctAction: 'fold',
      chosenAction: 'raise',
    })
  })
})
