import type { Action, Spot } from '../data/ranges-types.ts'
import { evDaMao } from './ev.ts'
import { nomeDaAcao } from './nomes.ts'

// Modelo da matriz 13×13 de um spot (spec 3). Puro TypeScript: sem Vue, sem Pinia. O componente
// só desenha o que sai daqui.

const RANKS = 'AKQJT98765432'

/** Tipo de cor semântico da célula. O componente o traduz nos tokens do design. */
export type CorDaCelula = 'raise' | 'call' | 'fold' | 'jam' | 'out'

export interface CelulaDaMatriz {
  /** Linha e coluna na grade 13×13, de 0 (A) a 12 (2). */
  row: number
  col: number
  /** Nome canônico: `AA`, `AKs`, `AKo`... */
  hand: string
  action: Action
  /** Nome de exibição da ação neste spot ("Open", "3bet", "4bet", "Jam", "Call", "Fold", "Fora do range"). */
  label: string
  color: CorDaCelula
  combos: number
  /** EV da ação em bb, só em call, raise e jam e quando a planilha o traz. Nunca em fold nem fora do range. */
  ev: number | null
  /** Mão de borda: contra regular, mão de ação sem EV (frequência provavelmente mista). */
  edgeHand: boolean
  /** Esta é a mão em foco (contorno branco). */
  focused: boolean
}

export interface EntradaDaLegenda {
  action: Action
  /** Nome de exibição da ação neste spot. */
  label: string
  /**
   * Percentual escrito na legenda da planilha, sobre as mãos que chegam ao spot. Ausente quando a
   * planilha não cita a ação (e em "Fora do range"). É um resumo por frequência, não a contagem de
   * células, e nunca é calculado a partir delas.
   */
  percent: number | null
}

export interface ResumoDoRange {
  /** Parte do baralho que chega ao spot, em %, com uma casa decimal: combos das mãos que não são fora do range sobre 1326. */
  deckPercent: number
  /** Percentual de cada ação, da legenda da planilha, sobre as mãos que chegam ao spot. */
  percents: Partial<Record<Action, number>>
}

export interface MatrizDoSpot {
  /** As 169 células, linha por linha. */
  cells: CelulaDaMatriz[]
  /** Só as ações que existem nas células, na ordem da planilha, e "Fora do range" ao final se o spot tem. */
  legend: EntradaDaLegenda[]
  summary: ResumoDoRange
}

/** O nome canônico da mão que a grade põe na linha e na coluna: par na diagonal, suited acima, offsuit abaixo. */
const nomeNaPosicao = (row: number, col: number): string =>
  row === col
    ? `${RANKS[row]}${RANKS[col]}`
    : col > row
      ? `${RANKS[row]}${RANKS[col]}s`
      : `${RANKS[col]}${RANKS[row]}o`

const COMBOS_DO_BARALHO = 1326

const corDaAcao = (action: Action): CorDaCelula => (action === 'out_of_range' ? 'out' : action)

/**
 * Monta a matriz de um spot, com a mão em foco opcional. A mão de cada célula vem da posição na
 * grade e é conferida contra o spot: a ordem do array não é confiada.
 */
export function montarMatriz(spot: Spot, maoEmFoco?: string): MatrizDoSpot {
  if (spot.hands.length !== 169) {
    throw new Error(`${spot.id}: a matriz precisa de 169 mãos, o spot tem ${spot.hands.length}`)
  }
  const porNome = new Map(spot.hands.map((h) => [h.hand, h]))
  if (maoEmFoco !== undefined && !porNome.has(maoEmFoco)) {
    throw new Error(`${spot.id}: a mão em foco ${maoEmFoco} não existe no spot`)
  }

  const cells: CelulaDaMatriz[] = []
  for (let row = 0; row < 13; row++) {
    for (let col = 0; col < 13; col++) {
      const nome = nomeNaPosicao(row, col)
      const mao = porNome.get(nome)
      if (!mao) throw new Error(`${spot.id}: falta a mão ${nome} (linha ${row}, coluna ${col})`)
      cells.push({
        row,
        col,
        hand: nome,
        action: mao.action,
        label: nomeDaAcao(spot.family, mao.action),
        color: corDaAcao(mao.action),
        combos: mao.combos,
        ...evDaMao(spot, mao),
        focused: nome === maoEmFoco,
      })
    }
  }

  const naCelula = new Set(cells.map((c) => c.action))
  const daPlanilha = (action: Action) => spot.legend.find((e) => e.action === action)?.percent ?? null
  // A ordem é a da legenda da planilha; as ações que as células têm e a legenda não cita vão depois.
  const ordem = [...new Set([...spot.legend.map((e) => e.action), ...naCelula])].filter(
    (a) => naCelula.has(a) && a !== 'out_of_range',
  )
  const legend: EntradaDaLegenda[] = ordem.map((action) => ({
    action,
    label: nomeDaAcao(spot.family, action),
    percent: daPlanilha(action),
  }))
  if (naCelula.has('out_of_range')) {
    legend.push({ action: 'out_of_range', label: nomeDaAcao(spot.family, 'out_of_range'), percent: null })
  }

  const percents: ResumoDoRange['percents'] = {}
  for (const { action, percent } of legend) if (percent !== null) percents[action] = percent
  const chegam = cells.filter((c) => c.action !== 'out_of_range').reduce((soma, c) => soma + c.combos, 0)
  const summary = { deckPercent: Math.round((chegam / COMBOS_DO_BARALHO) * 1000) / 10, percents }

  return { cells, legend, summary }
}
