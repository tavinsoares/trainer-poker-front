import { describe, expect, it } from 'vitest'
import { avaliar } from '../../src/domain/avaliacao.ts'
import { dados, perguntasPorSpotEMao } from './auxiliares.ts'

// Seam 2 da spec 2: a avaliação (dados, pergunta e ação escolhida → veredito).
// Roda contra o ranges.json real. As perguntas vêm do sorteio, achadas por amostragem.
const perguntas = perguntasPorSpotEMao()
const pergunta = (spot: string, mao: string) => {
  const achada = perguntas.get(`${spot}|${mao}`)
  if (!achada) throw new Error(`o sorteio não produziu ${mao} no spot ${spot}`)
  return achada
}

describe('avaliação do RFI contra regular', () => {
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
        const p = perguntas.get(`${spot.id}|${mao.hand}`)
        if (!p) {
          violacoes.push(`${spot.id}: o sorteio não produziu a mão ${mao.hand}`)
          continue
        }
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
