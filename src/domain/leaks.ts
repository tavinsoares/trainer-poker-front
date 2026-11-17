import type { Position, RangesData, Spot, SpotFamily, VillainType } from '../data/ranges-types.ts'
import type { RegistroDeResposta } from './sessao.ts'
import { ROTULO_DA_FAMILIA } from './visao.ts'

// Os leaks (spec 5): onde o aluno erra, calculado a partir dos registros do histórico. Uma função
// pura dos registros, dos dados dos spots, dos filtros e do relógio. Sem Vue e sem `Date.now`.

export type PeriodoDosLeaks = '7d' | '30d' | 'tudo'

export interface FiltrosDosLeaks {
  vilao: VillainType | 'ambos'
  periodo: PeriodoDosLeaks
}

export const FILTROS_DOS_LEAKS_PADRAO: FiltrosDosLeaks = { vilao: 'ambos', periodo: 'tudo' }

/** Um spot só entra na tabela com tentativas suficientes para a taxa não ser acaso. */
export const MINIMO_DE_TENTATIVAS = 10
export const LIMITE_DE_LINHAS = 10

const MS_POR_DIA = 24 * 60 * 60 * 1000
const DIAS_DO_PERIODO: Record<PeriodoDosLeaks, number | null> = { '7d': 7, '30d': 30, tudo: null }

const POSICOES: Position[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']
const FAMILIAS: SpotFamily[] = ['rfi', '3bet', 'bb-defense', 'vs-3bet', 'vs-4bet', 'vs-jam']
const VILOES: { chave: VillainType; rotulo: string }[] = [
  { chave: 'regular', rotulo: 'Regular' },
  { chave: 'fish', rotulo: 'Fish' },
]

export interface Metricas {
  respostas: number
  corretas: number
  erros: number
  /** Percentual de acerto com uma casa decimal, ou `null` sem respostas. */
  taxaDeAcerto: number | null
  /** Percentual de erro com uma casa decimal, ou `null` sem respostas. */
  taxaDeErro: number | null
  /** Soma do EV deixado na mesa, em bb, com duas casas. Só existe em folds errados contra regular. */
  evDeixado: number
  /** Quantos folds incorretos com EV formaram essa soma. */
  foldsComEv: number
}

export interface LinhaDeErro {
  chave: string
  rotulo: string
  tentativas: number
  erros: number
  /** Percentual de erro com uma casa decimal, ou `null` sem tentativas (e não 0%). */
  taxaDeErro: number | null
}

export interface LinhaDeSpot {
  spotId: string
  nome: string
  vilao: VillainType
  familia: SpotFamily
  hero: Position
  tentativas: number
  erros: number
  taxaDeErro: number
  /** A mão com mais erros no spot (desempate pelo nome da mão). */
  maoMaisErrada: string
  /** Soma do EV deixado no spot, ou `null` contra fish, em que a planilha não traz EV. */
  evDeixado: number | null
}

export type EstadoDosLeaks = 'sem-historico' | 'sem-respostas-nos-filtros' | 'ok'

export interface ResultadoDosLeaks {
  filtros: FiltrosDosLeaks
  estado: EstadoDosLeaks
  metricas: Metricas
  porVilao: LinhaDeErro[]
  porPosicao: LinhaDeErro[]
  porFamilia: LinhaDeErro[]
  /** Os spots com mais erros. Vazia também quando nenhum spot atinge o mínimo de tentativas. */
  spots: LinhaDeSpot[]
  /** Registros de spots que não existem mais nos dados: contam nas métricas e nas barras, não na tabela. */
  registrosForaDaTabela: number
}

const arredondar = (n: number, casas: number): number => Math.round(n * 10 ** casas) / 10 ** casas
const percentual = (parte: number, total: number): number | null => (total === 0 ? null : arredondar((parte / total) * 100, 1))

/** O nome do spot na tabela: "BB vs open do BTN", "UTG abre (RFI)". O vilão (regular ou fish) é outra coluna. */
export function nomeDoSpot(spot: Spot): string {
  if (spot.family === 'rfi') return `${spot.hero} abre (RFI)`
  const vilao = spot.villain.position
  if (!vilao) throw new Error(`o spot ${spot.id} não tem a posição do vilão`)
  const situacao: Record<Exclude<SpotFamily, 'rfi'>, string> = {
    '3bet': '3bet vs open do',
    'bb-defense': 'vs open do',
    'vs-3bet': 'vs 3bet do',
    'vs-4bet': 'vs 4bet do',
    'vs-jam': 'vs jam do',
  }
  return `${spot.hero} ${situacao[spot.family]} ${vilao}`
}

function dentroDoFiltro(registro: RegistroDeResposta, filtros: FiltrosDosLeaks, limite: number | null): boolean {
  if (filtros.vilao !== 'ambos' && registro.villainType !== filtros.vilao) return false
  return limite === null || Date.parse(registro.answeredAt) >= limite
}

function linhas<T extends string>(
  chaves: { chave: T; rotulo: string }[],
  registros: RegistroDeResposta[],
  chaveDe: (r: RegistroDeResposta) => T,
): LinhaDeErro[] {
  return chaves.map(({ chave, rotulo }) => {
    const doGrupo = registros.filter((r) => chaveDe(r) === chave)
    const erros = doGrupo.filter((r) => !r.correct).length
    return { chave, rotulo, tentativas: doGrupo.length, erros, taxaDeErro: percentual(erros, doGrupo.length) }
  })
}

const comparar = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)

function linhaDoSpot(spot: Spot, registros: RegistroDeResposta[]): LinhaDeSpot | null {
  const erros = registros.filter((r) => !r.correct)
  if (registros.length < MINIMO_DE_TENTATIVAS || erros.length === 0) return null
  const porMao = new Map<string, number>()
  for (const r of erros) porMao.set(r.hand, (porMao.get(r.hand) ?? 0) + 1)
  const [maoMaisErrada] = [...porMao.entries()].sort(([nomeA, a], [nomeB, b]) => b - a || comparar(nomeA, nomeB))[0]!
  return {
    spotId: spot.id,
    nome: nomeDoSpot(spot),
    vilao: spot.villain.type,
    familia: spot.family,
    hero: spot.hero,
    tentativas: registros.length,
    erros: erros.length,
    taxaDeErro: percentual(erros.length, registros.length)!,
    maoMaisErrada,
    evDeixado: spot.villain.type === 'fish' ? null : arredondar(registros.reduce((soma, r) => soma + (r.evLeft ?? 0), 0), 2),
  }
}

export function calcularLeaks(
  dados: RangesData,
  historico: readonly RegistroDeResposta[],
  filtros: FiltrosDosLeaks,
  agora: string,
): ResultadoDosLeaks {
  const dias = DIAS_DO_PERIODO[filtros.periodo]
  const limite = dias === null ? null : Date.parse(agora) - dias * MS_POR_DIA
  const registros = historico.filter((r) => dentroDoFiltro(r, filtros, limite))

  const erros = registros.filter((r) => !r.correct).length
  const comEv = registros.filter((r) => r.evLeft !== null)
  const metricas: Metricas = {
    respostas: registros.length,
    corretas: registros.length - erros,
    erros,
    taxaDeAcerto: percentual(registros.length - erros, registros.length),
    taxaDeErro: percentual(erros, registros.length),
    evDeixado: arredondar(comEv.reduce((soma, r) => soma + (r.evLeft ?? 0), 0), 2),
    foldsComEv: comEv.length,
  }

  const spotsPorId = new Map(dados.spots.map((s) => [s.id, s]))
  const porSpot = new Map<string, RegistroDeResposta[]>()
  let registrosForaDaTabela = 0
  for (const r of registros) {
    if (!spotsPorId.has(r.spotId)) {
      registrosForaDaTabela++
      continue
    }
    const lista = porSpot.get(r.spotId)
    if (lista) lista.push(r)
    else porSpot.set(r.spotId, [r])
  }
  const spots = [...porSpot.entries()]
    .map(([id, doSpot]) => linhaDoSpot(spotsPorId.get(id)!, doSpot))
    .filter((l): l is LinhaDeSpot => l !== null)
    .sort((a, b) => b.erros / b.tentativas - a.erros / a.tentativas || b.erros - a.erros || b.tentativas - a.tentativas || comparar(a.spotId, b.spotId))
    .slice(0, LIMITE_DE_LINHAS)

  return {
    filtros,
    estado: historico.length === 0 ? 'sem-historico' : registros.length === 0 ? 'sem-respostas-nos-filtros' : 'ok',
    metricas,
    porVilao: linhas(VILOES, registros, (r) => r.villainType),
    porPosicao: linhas(POSICOES.map((p) => ({ chave: p, rotulo: p })), registros, (r) => r.hero),
    porFamilia: linhas(FAMILIAS.map((f) => ({ chave: f, rotulo: ROTULO_DA_FAMILIA[f] })), registros, (r) => r.family),
    spots,
    registrosForaDaTabela,
  }
}
