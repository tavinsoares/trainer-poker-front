import type { RangesData } from '../data/ranges-types.ts'
import type { AnswerableAction, Question, Verdict } from './tipos.ts'

/** Pontuação binária: correta quando a ação escolhida é a da mão no spot, erro em qualquer outro caso. */
export function avaliar(dados: RangesData, pergunta: Question, escolhida: AnswerableAction): Verdict {
  const spot = dados.spots.find((s) => s.id === pergunta.spot.id)
  if (!spot) throw new Error(`o spot ${pergunta.spot.id} não existe nos dados`)
  const mao = spot.hands.find((h) => h.hand === pergunta.hand.name)
  if (!mao) throw new Error(`a mão ${pergunta.hand.name} não existe no spot ${spot.id}`)
  if (mao.action === 'out_of_range') {
    throw new Error(`a mão ${mao.hand} está fora do range do spot ${spot.id} e não pode ser pergunta`)
  }
  const ev = mao.action === 'fold' ? null : mao.ev
  const deixouNaMesa = escolhida === 'fold' && mao.action !== 'fold' && spot.villain.type === 'regular' && ev !== null && ev > 0
  return {
    correct: escolhida === mao.action,
    correctAction: mao.action,
    chosenAction: escolhida,
    ev,
    evLeft: deixouNaMesa ? ev : null,
    edgeHand: spot.villain.type === 'regular' && mao.action !== 'fold' && mao.ev === null,
    villainType: spot.villain.type,
  }
}
