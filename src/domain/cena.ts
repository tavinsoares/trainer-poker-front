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

type Medir = (campo: string, ler: (s: Sizings) => number | undefined) => Tamanho

/**
 * Lê um tamanho do spot. A planilha não traz todos os tamanhos contra fish: o que falta vem do
 * spot equivalente contra regular (mesma família, Hero e posição do vilão) e fica marcado como
 * estimado. Sem tamanho nem equivalente, é um erro que nomeia o spot e o campo.
 */
const medidor = (dados: RangesData, spot: Spot): Medir => {
  const equivalente =
    spot.villain.type === 'fish' ? dados.spots.find((s) => s.id === spot.id.replace(/-fish$/, '-regular')) : undefined
  return (campo, ler) => {
    const proprio = ler(spot.sizings)
    if (proprio !== undefined) return { size: proprio, estimated: false }
    const emprestado = equivalente && ler(equivalente.sizings)
    if (emprestado !== undefined) return { size: emprestado, estimated: true }
    throw new Error(`${spot.id}: falta o tamanho "${campo}"`)
  }
}

const aposta = (position: Position, action: Bet['action'], { size, estimated }: Tamanho): Bet => ({
  position,
  action,
  size,
  estimated,
})

interface Descricao {
  /** As apostas até a vez do Hero, em ordem. */
  history: Bet[]
  call: boolean
  /** O raise do Hero (open, 3bet ou 4bet), com o rótulo e o tamanho. */
  raise?: { label: string; tamanho: Tamanho }
  jam: boolean
}

/** O que muda de família para família: as apostas, e quais botões fazem sentido. */
function descrever(spot: Spot, medir: Medir): Descricao {
  const { family } = spot
  const hero = spot.hero
  const vilao = spot.villain.position
  if (family === 'rfi') {
    return { history: [], call: false, raise: { label: 'Open', tamanho: medir('open', (s) => s.open) }, jam: false }
  }
  if (!vilao) throw new Error(`${spot.id}: falta a posição do vilão`)
  const openDoVilao = () => aposta(vilao, 'open', medir(`open do ${vilao}`, (s) => s.vsOpen[vilao]))
  const openDoHero = () => aposta(hero, 'open', medir('open do Hero', (s) => s.open))

  switch (family) {
    case '3bet':
    case 'bb-defense':
      return {
        history: [openDoVilao()],
        call: true,
        raise: { label: '3bet', tamanho: medir('3bet do Hero', (s) => s.threeBet) },
        jam: false,
      }
    case 'vs-3bet':
      return {
        history: [openDoHero(), aposta(vilao, '3bet', medir(`3bet do ${vilao}`, (s) => s.vs3bet[vilao]))],
        call: true,
        raise: { label: '4bet', tamanho: medir('4bet do Hero', (s) => s.fourBet) },
        jam: spot.hands.some((h) => h.action === 'jam'),
      }
    case 'vs-4bet':
      return {
        history: [
          openDoVilao(),
          aposta(hero, '3bet', medir('3bet do Hero', (s) => s.threeBet)),
          aposta(vilao, '4bet', medir('4bet enfrentado', (s) => s.vs4bet)),
        ],
        call: true,
        jam: true,
      }
    case 'vs-jam':
      return {
        history: [openDoHero(), aposta(vilao, 'jam', { size: STACK, estimated: false })],
        call: true,
        jam: false,
      }
  }
}

function botoes({ call, raise, jam }: Descricao): ActionOption[] {
  const options: ActionOption[] = [{ action: 'fold', label: 'Fold' }]
  if (call) options.push({ action: 'call', label: 'Call' })
  if (raise) {
    const { size, estimated } = raise.tamanho
    options.push({ action: 'raise', label: raise.label, size, ...(estimated ? { estimated } : {}) })
  }
  if (jam) options.push({ action: 'jam', label: 'Jam', size: STACK })
  return options
}

export function montarCena(dados: RangesData, spot: Spot): Cena {
  const descricao = descrever(spot, medidor(dados, spot))
  const { history } = descricao
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

  return { stack: STACK, pot, toCall, history, seats, options: botoes(descricao) }
}
