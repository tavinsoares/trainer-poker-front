import type { AnswerableAction, Question, Verdict } from './tipos.ts'

// Texto do feedback gerado por template, só a partir dos dados: o que o aluno escolheu, a ação
// certa e o EV quando existe. Sem explicações de estratégia, porque os dados não as trazem.

type Resultado = Omit<Verdict, 'title' | 'body'>

/** O nome de exibição de uma ação nesta pergunta: o mesmo do botão. */
const nome = (pergunta: Question, acao: AnswerableAction): string => {
  const botao = pergunta.options.find((o) => o.action === acao)
  if (!botao) throw new Error(`${pergunta.spot.id}: a ação ${acao} não tem botão nesta pergunta`)
  return botao.label
}

/** 10.32 → "10,32 bb". */
const bb = (n: number) => `${String(n).replace('.', ',')} bb`

export function escreverFeedback(pergunta: Question, v: Resultado): Pick<Verdict, 'title' | 'body'> {
  const certa = nome(pergunta, v.correctAction)
  const escolhida = nome(pergunta, v.chosenAction)
  const frases = [v.correct ? `Você escolheu ${escolhida} e acertou.` : `Você escolheu ${escolhida}; a ação certa é ${certa}.`]
  if (v.ev !== null) frases.push(`EV da ação certa: ${bb(v.ev)}.`)
  if (v.evLeft !== null) frases.push(`Você deixou ${bb(v.evLeft)} na mesa.`)
  if (v.villainType === 'fish') frases.push('Sem EV para este spot: a planilha não traz EV nos spots contra fish.')
  if (v.edgeHand) frases.push('Mão de borda: a planilha não traz EV, e a frequência real pode ser mista.')
  return { title: `${pergunta.hand.name} é ${certa.toLowerCase()} neste spot`, body: frases.join(' ') }
}
