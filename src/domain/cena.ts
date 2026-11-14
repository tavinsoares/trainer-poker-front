import type { Position, RangesData, Sizings, Spot } from '../data/ranges-types.ts'
import type { ActionOption, Bet, Question, Seat } from './tipos.ts'

// A cena de um spot (spec 2): quem agiu, com que tamanho, pote, valor a pagar e botões.
// Contabilidade: cada assento tem investido o total da última aposta (que já inclui o blind do
// SB ou do BB) ou o blind dele, ou zero. Pote = soma do investido. Valor a pagar = maior
// investido entre os outros menos o do Hero.

export const POSICOES: Position[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']
const STACK = 100
const BLINDS: Partial<Record<Position, number>> = { SB: 0.5, BB: 1 }

const arredondar = (n: number) => Math.round(n * 100) / 100

type Cena = Pick<Question, 'stack' | 'pot' | 'toCall' | 'history' | 'seats' | 'options'>

interface Tamanho {
  size: number
  estimated: boolean
}

/** Lê um tamanho do spot. Falta de tamanho é um erro que nomeia o spot e o campo. */
const medir = (spot: Spot, campo: string, ler: (s: Sizings) => number | undefined): Tamanho => {
  const size = ler(spot.sizings)
  if (size === undefined) throw new Error(`${spot.id}: falta o tamanho "${campo}"`)
  return { size, estimated: false }
}

const aposta = (position: Position, action: Bet['action'], { size, estimated }: Tamanho): Bet => ({
  position,
  action,
  size,
  estimated,
})

/** As apostas até a vez do Hero e o tamanho do raise dele, por família. */
function jogadas(spot: Spot): { history: Bet[]; raise: Tamanho } {
  const vilao = spot.villain.position
  if (spot.family === 'rfi') return { history: [], raise: medir(spot, 'open', (s) => s.open) }
  if (spot.family === '3bet' || spot.family === 'bb-defense') {
    if (!vilao) throw new Error(`${spot.id}: falta a posição do vilão`)
    return {
      history: [aposta(vilao, 'open', medir(spot, `open do ${vilao}`, (s) => s.vsOpen[vilao]))],
      raise: medir(spot, '3bet do Hero', (s) => s.threeBet),
    }
  }
  throw new Error(`${spot.id}: a família ${spot.family} ainda não tem cena`)
}

function botoes(spot: Spot, raise: Tamanho): ActionOption[] {
  const fold: ActionOption = { action: 'fold', label: 'Fold' }
  const call: ActionOption = { action: 'call', label: 'Call' }
  const raiseOption: ActionOption = {
    action: 'raise',
    label: spot.family === 'rfi' ? 'Open' : '3bet',
    size: raise.size,
  }
  if (raise.estimated) raiseOption.estimated = true
  return spot.family === 'rfi' ? [fold, raiseOption] : [fold, call, raiseOption]
}

export function montarCena(_dados: RangesData, spot: Spot): Cena {
  const { history, raise } = jogadas(spot)
  const primeiraDecisao = ['rfi', '3bet', 'bb-defense'].includes(spot.family)

  const ultima = (posicao: Position) => [...history].reverse().find((b) => b.position === posicao)
  const investido = (posicao: Position) => ultima(posicao)?.size ?? BLINDS[posicao] ?? 0
  const indiceDoHero = POSICOES.indexOf(spot.hero)

  const seats: Seat[] = POSICOES.map((position, i): Seat => {
    if (position === spot.hero) return { position, state: 'hero' }
    const agiu = ultima(position)
    if (agiu) return { position, state: 'acted', action: agiu.action, size: agiu.size, estimated: agiu.estimated }
    return { position, state: primeiraDecisao && i > indiceDoHero ? 'waiting' : 'folded' }
  })

  const pot = arredondar(POSICOES.reduce((soma, p) => soma + investido(p), 0))
  const dosOutros = Math.max(...POSICOES.filter((p) => p !== spot.hero).map(investido))
  const toCall = spot.family === 'rfi' ? null : arredondar(dosOutros - investido(spot.hero))

  return { stack: STACK, pot, toCall, history, seats, options: botoes(spot, raise) }
}
