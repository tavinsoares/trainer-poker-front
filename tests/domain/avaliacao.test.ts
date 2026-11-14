import { describe, expect, it } from 'vitest'
import { avaliar } from '../../src/domain/avaliacao.ts'
import { dados, perguntaDe as pergunta } from './auxiliares.ts'

// Seam 2 da spec 2: a avaliação (dados, pergunta e ação escolhida → veredito).
// Roda contra o ranges.json real. As perguntas vêm do sorteio, com o rng roteirizado. A varredura de
// todas as abas e mãos está em ev.test.ts.
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

  // Ao enfrentar agressão: na aba BBv4B BTN, AA é jam (EV 63,69); no BTNvJAM BB, AA é call (EV 95,19) e Q9s é fold.
  it('vs 4bet e vs jam: o call em mão de jam é erro, e o call em mão de fold também', () => {
    expect(avaliar(dados, pergunta('vs-4bet-bb-vs-btn-regular', 'AA'), 'jam')).toMatchObject({ correct: true })
    expect(avaliar(dados, pergunta('vs-4bet-bb-vs-btn-regular', 'AA'), 'call')).toMatchObject({ correct: false, correctAction: 'jam' })
    expect(avaliar(dados, pergunta('vs-jam-btn-vs-bb-regular', 'Q9s'), 'call')).toMatchObject({ correct: false, correctAction: 'fold' })
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
