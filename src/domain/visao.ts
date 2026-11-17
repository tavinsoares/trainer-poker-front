import type { Position, Spot, SpotFamily, VillainType } from '../data/ranges-types.ts'
import { dataBr } from './formato.ts'
import { numeroDaPergunta, spotDaPergunta, type Sessao } from './sessao.ts'
import type { AnswerableAction, Bet, Card, Question, Seat, Suit } from './tipos.ts'

// A visão da pergunta (spec 4): tudo o que a tela desenha, calculado a partir da sessão. Os
// componentes só desenham: não calculam pote, texto, assento nem botão.

export const ROTULO_DA_FAMILIA: Record<SpotFamily, string> = {
  rfi: 'RFI',
  '3bet': '3bet',
  'bb-defense': 'Defesa do BB',
  'vs-3bet': 'vs 3bet',
  'vs-4bet': 'vs 4bet',
  'vs-jam': 'vs jam',
}

const SIMBOLO: Record<Suit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }

const ATALHO: Record<AnswerableAction, 'F' | 'C' | 'R' | 'J'> = { fold: 'F', call: 'C', raise: 'R', jam: 'J' }

/** 2.5 → "2,5bb", e "~2,5bb" quando o tamanho é estimado. */
export const bb = (n: number, estimado = false): string => `${estimado ? '~' : ''}${String(n).replace('.', ',')}bb`

export interface VisaoBotao {
  action: AnswerableAction
  nome: string
  atalho: 'F' | 'C' | 'R' | 'J'
  subtitulo: string
}

export interface VisaoAssento {
  position: Position
  estado: Seat['state']
  /** A posição, com "· você" no Hero. */
  titulo: string
  /** O que o assento fez ("fold", "open 2bb", "aguardando") ou, no Hero, o stack e o investido. */
  detalhe: string
}

export interface VisaoCarta {
  rank: string
  naipe: Suit
  simbolo: string
  /** Copas e ouros. */
  vermelho: boolean
}

export interface VisaoDaPergunta {
  numero: number
  familia: string
  /** "SPOT 15 · DEFESA DO BB". */
  rotulo: string
  vilao: { tipo: VillainType; rotulo: string }
  titulo: string
  chips: { id: 'pote' | 'a-pagar' | 'stack'; texto: string }[]
  assentos: VisaoAssento[]
  mao: { nome: string; cartas: [VisaoCarta, VisaoCarta] }
  botoes: VisaoBotao[]
}

const carta = ({ rank, suit }: Card): VisaoCarta => ({
  rank,
  naipe: suit,
  simbolo: SIMBOLO[suit],
  vermelho: suit === 'h' || suit === 'd',
})

const BLINDS: Partial<Record<Position, number>> = { SB: 0.5, BB: 1 }

const ultimaAposta = (history: Bet[], posicao: Position): Bet | undefined => [...history].reverse().find((b) => b.position === posicao)

const tamanho = (history: Bet[], acao: Bet['action']): string => {
  const aposta = history.find((b) => b.action === acao)
  if (!aposta) throw new Error(`a história não tem a aposta ${acao}`)
  return bb(aposta.size, aposta.estimated)
}

/** O título da situação, por família, com os tamanhos da história. */
function titulo(pergunta: Question): string {
  const { family, hero, villain } = pergunta.spot
  const { history } = pergunta
  const vilao = villain.position
  if (family === 'rfi') {
    return hero === 'UTG' ? `Você está no ${hero}. Você é o primeiro a agir.` : `Você está no ${hero}. Todos deram fold até você.`
  }
  if (!vilao) throw new Error(`${pergunta.spot.id}: falta a posição do vilão`)
  switch (family) {
    case '3bet':
    case 'bb-defense':
      return `Você está no ${hero}. O ${vilao} abre para ${tamanho(history, 'open')}.`
    case 'vs-3bet':
      return `Você abriu para ${tamanho(history, 'open')} no ${hero}. O ${vilao} dá 3bet para ${tamanho(history, '3bet')}.`
    case 'vs-4bet':
      return (
        `O ${vilao} abre para ${tamanho(history, 'open')}, você dá 3bet para ${tamanho(history, '3bet')} no ${hero} ` +
        `e o ${vilao} dá 4bet para ${tamanho(history, '4bet')}.`
      )
    case 'vs-jam':
      return `Você abriu para ${tamanho(history, 'open')} no ${hero}. O ${vilao} dá jam de ${tamanho(history, 'jam')}.`
  }
}

function assento(seat: Seat, pergunta: Question): VisaoAssento {
  const { position } = seat
  switch (seat.state) {
    case 'hero': {
      const aposta = ultimaAposta(pergunta.history, position)
      const blind = BLINDS[position]
      const investido = aposta ? bb(aposta.size, aposta.estimated) : blind ? bb(blind) : null
      const stack = bb(pergunta.stack)
      return { position, estado: 'hero', titulo: `${position} · você`, detalhe: investido ? `${stack} · ${investido} posto` : stack }
    }
    case 'acted':
      if (!seat.action || seat.size === undefined) throw new Error(`${pergunta.spot.id}: o assento ${position} agiu sem jogada`)
      return { position, estado: 'acted', titulo: position, detalhe: `${seat.action} ${bb(seat.size, seat.estimated)}` }
    case 'waiting':
      return { position, estado: 'waiting', titulo: position, detalhe: 'aguardando' }
    case 'folded':
      return { position, estado: 'folded', titulo: position, detalhe: 'fold' }
  }
}

function botoes(pergunta: Question): VisaoBotao[] {
  const estimada = pergunta.history.some((b) => b.estimated)
  return pergunta.options.map((o): VisaoBotao => {
    const tamanhoDoBotao = o.size === undefined ? '' : bb(o.size, o.estimated)
    const subtitulo = {
      fold: 'Abandona o pote',
      call: `Paga ${bb(pergunta.toCall ?? 0, estimada)}`,
      raise: pergunta.spot.family === 'rfi' ? `Abre para ${tamanhoDoBotao}` : `Re-aumenta para ${tamanhoDoBotao}`,
      jam: `Aposta os ${bb(pergunta.stack)}`,
    }[o.action]
    return { action: o.action, nome: o.label, atalho: ATALHO[o.action], subtitulo }
  })
}

/** A visão da pergunta atual. A sessão precisa ter pergunta (`perguntando` ou `respondida`). */
export function visaoDaPergunta(sessao: Sessao): VisaoDaPergunta {
  const { pergunta } = sessao
  if (!pergunta) throw new Error('a sessão não tem pergunta')
  const familia = ROTULO_DA_FAMILIA[pergunta.spot.family]
  const estimada = pergunta.history.some((b) => b.estimated)
  const chips: VisaoDaPergunta['chips'] = [{ id: 'pote', texto: `Pote: ${bb(pergunta.pot, estimada)}` }]
  if (pergunta.toCall !== null) chips.push({ id: 'a-pagar', texto: `A pagar: ${bb(pergunta.toCall, estimada)}` })
  chips.push({ id: 'stack', texto: `Stack efetivo: ${bb(pergunta.stack)}` })
  const [primeira, segunda] = pergunta.hand.cards
  return {
    numero: numeroDaPergunta(sessao),
    familia,
    rotulo: `SPOT ${numeroDaPergunta(sessao)} · ${familia.toUpperCase()}`,
    vilao: { tipo: pergunta.spot.villain.type, rotulo: `Vilão: ${pergunta.spot.villain.type}` },
    titulo: titulo(pergunta),
    chips,
    assentos: pergunta.seats.map((s) => assento(s, pergunta)),
    mao: { nome: pergunta.hand.name, cartas: [carta(primeira), carta(segunda)] },
    botoes: botoes(pergunta),
  }
}

export interface LinhaDeEv {
  rotulo: string
  valor: string
}

/**
 * O bloco de EV do feedback. Contra regular: as linhas de EV (ação certa e fold), "Você deixou X bb
 * na mesa" quando há, o aviso de mão de borda quando é o caso e a nota. Contra fish: só a mensagem.
 */
export type BlocoDeEv =
  | { tipo: 'regular'; linhas: LinhaDeEv[]; deixou: string | null; aviso: string | null; nota: string }
  | { tipo: 'fish'; mensagem: string }

export interface VisaoDoFeedback {
  correta: boolean
  resultado: 'CORRETA' | 'ERRO'
  /** A visão da pergunta (cabeçalho, mesa, mão): o feedback a mantém na tela. */
  pergunta: VisaoDaPergunta
  mao: VisaoDaPergunta['mao']
  /** Nome de exibição (o do botão) da ação escolhida e da ação certa. */
  escolhida: string
  certa: string
  titulo: string
  corpo: string
  ev: BlocoDeEv
  /** O spot completo e a mão em foco, para a matriz. */
  spot: Spot
  maoEmFoco: string
  notaDaMatriz: string
  procedencia: string
}

const evEmBb = (n: number): string => `${n > 0 ? '+' : ''}${String(n).replace('.', ',')} bb`

/** O feedback da pergunta respondida. A sessão precisa estar em `respondida`. */
export function visaoDoFeedback(sessao: Sessao): VisaoDoFeedback {
  const { pergunta, veredito } = sessao
  if (sessao.estado !== 'respondida' || !pergunta || !veredito) {
    throw new Error('o feedback só existe com a sessão respondida')
  }
  const nome = (acao: AnswerableAction): string => {
    const botao = pergunta.options.find((o) => o.action === acao)
    if (!botao) throw new Error(`${pergunta.spot.id}: a ação ${acao} não tem botão nesta pergunta`)
    return botao.label
  }
  const certa = nome(veredito.correctAction)
  const visaoPergunta = visaoDaPergunta(sessao)
  const mao = pergunta.hand.name

  let ev: BlocoDeEv
  if (veredito.villainType === 'fish') {
    ev = { tipo: 'fish', mensagem: 'Sem EV para este spot. A planilha não traz EV nos spots contra fish.' }
  } else {
    const linhas: LinhaDeEv[] = []
    if (veredito.ev !== null) linhas.push({ rotulo: `${certa} com ${mao}`, valor: evEmBb(veredito.ev) })
    linhas.push({ rotulo: 'Fold', valor: '0 bb' })
    ev = {
      tipo: 'regular',
      linhas,
      deixou: veredito.evLeft === null ? null : `Você deixou ${String(veredito.evLeft).replace('.', ',')} bb na mesa.`,
      aviso: veredito.edgeHand ? 'Mão de borda: a planilha não traz EV, e a frequência real pode ser mista.' : null,
      nota: 'O EV vem da planilha e só existe em spots contra regular.',
    }
  }

  return {
    correta: veredito.correct,
    resultado: veredito.correct ? 'CORRETA' : 'ERRO',
    pergunta: visaoPergunta,
    mao: visaoPergunta.mao,
    escolhida: nome(veredito.chosenAction),
    certa,
    titulo: veredito.title,
    corpo: veredito.body,
    ev,
    spot: spotDaPergunta(sessao),
    maoEmFoco: mao,
    notaDaMatriz: `Contorno branco: ${mao}, a mão deste spot.`,
    procedencia: `Fonte: ${sessao.deps.dados.manifest.source} · importado em ${dataBr(sessao.deps.dados.manifest.importedAt)}`,
  }
}
