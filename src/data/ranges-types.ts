// Formato do JSON gerado pelo conversor a partir da planilha do Metagame.
// É a única interface entre o pipeline de dados e o app.

export type Position = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB'

/**
 * Família do spot: abrir o pote (`rfi`), 3bet contra um open (`3bet`) e defesa do BB
 * contra um open (`bb-defense`).
 */
export type SpotFamily = 'rfi' | '3bet' | 'bb-defense'

export type VillainType = 'regular' | 'fish'

/** Vocabulário fechado de ações. O rótulo original da legenda fica em `label`. */
export type Action = 'fold' | 'call' | 'raise' | 'jam' | 'out_of_range'

export interface Manifest {
  /** Nome da fonte, para exibição ao aluno. */
  source: string
  /** Data da importação (AAAA-MM-DD). */
  importedAt: string
  schemaVersion: number
  /** SHA-256 do arquivo da planilha de origem. */
  sourceSha256: string
}

export interface Sizings {
  /** Tamanho do open do próprio Hero, em bb (a aba traz quando o Hero também abre o pote). */
  open?: number
  /** Tamanho do 3bet do Hero, em bb (spots de 3bet e de defesa do BB). */
  threeBet?: number
  /** Tamanho do 4bet que o Hero enfrentaria depois de dar 3bet, em bb. */
  vs4bet?: number
  /** Tamanho do 3bet que o Hero enfrenta, por posição de quem deu o 3bet, em bb. */
  vs3bet: Partial<Record<Position, number>>
  /** Tamanho do open que o Hero enfrenta, por posição de quem abriu, em bb. */
  vsOpen: Partial<Record<Position, number>>
}

export interface LegendEntry {
  /** Rótulo original da legenda da aba (por exemplo, "RFI" ou "FOLD"). */
  label: string
  action: Action
  /** Percentual escrito na legenda, de 0 a 100. */
  percent: number
}

export interface Hand {
  /** Nome canônico: `AA`, `AKs`, `AKo`... */
  hand: string
  action: Action
  /** Rótulo da legenda correspondente à cor da célula. */
  label: string
  /** 6 para par, 4 para suited, 12 para offsuit. */
  combos: number
  /** EV em bb quando a planilha o traz, `null` quando não traz. */
  ev: number | null
}

export interface Spot {
  id: string
  family: SpotFamily
  hero: Position
  villain: { type: VillainType; position: Position | null }
  /** Nome da aba de origem, para rastreio. */
  sourceSheet: string
  sizings: Sizings
  legend: LegendEntry[]
  /** As 169 mãos canônicas, na ordem da matriz (A, K, Q... 2; linha por linha). */
  hands: Hand[]
}

export interface RangesData {
  manifest: Manifest
  spots: Spot[]
}
