import type { Hand, Spot } from '../data/ranges-types.ts'

// O que os dados sabem sobre o EV de uma mão (spec 2), compartilhado entre a avaliação e a matriz
// (spec 3) para que nunca divirjam.

export interface EvDaMao {
  /**
   * EV da ação da mão em bb, quando a ação é call, raise ou jam e a planilha o traz. O fold vale
   * zero por definição, então o EV que a planilha escreve numa mão de fold não é usado; fora do
   * range também não tem EV.
   */
  ev: number | null
  /** Mão de borda: contra regular, mão de ação sem EV na planilha (frequência provavelmente mista). */
  edgeHand: boolean
}

export function evDaMao(spot: Pick<Spot, 'villain'>, mao: Hand): EvDaMao {
  const deAcao = mao.action !== 'fold' && mao.action !== 'out_of_range'
  return {
    ev: deAcao ? mao.ev : null,
    edgeHand: deAcao && spot.villain.type === 'regular' && mao.ev === null,
  }
}
