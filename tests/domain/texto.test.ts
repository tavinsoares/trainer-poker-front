import { describe, expect, it } from 'vitest'
import { avaliar } from '../../src/domain/avaliacao.ts'
import { dados, perguntaDe } from './auxiliares.ts'

// Seam 2 da spec 2 (a avaliação), olhado pelo texto do feedback gerado por template.
// Os textos de referência são literais escritos a partir da spec e dos valores da planilha
// (AA do UTG com EV 10,32, KQo da defesa do BB contra o UTG com 0,47).

const veredito = (spot: string, mao: string, escolhida: Parameters<typeof avaliar>[2]) =>
  avaliar(dados, perguntaDe(spot, mao), escolhida)

describe('texto do feedback', () => {
  it('acerto: "{mão} é {ação} neste spot", a escolha acertada e o EV da ação certa', () => {
    expect(veredito('rfi-utg-regular', 'AA', 'raise')).toMatchObject({
      title: 'AA é open neste spot',
      body: 'Você escolheu Open e acertou. EV da ação certa: 10,32 bb.',
    })
  })

  it('erro: diz o que o aluno escolheu e a ação certa, e acrescenta o EV deixado na mesa', () => {
    expect(veredito('rfi-utg-regular', 'AA', 'fold')).toMatchObject({
      title: 'AA é open neste spot',
      body: 'Você escolheu Fold; a ação certa é Open. EV da ação certa: 10,32 bb. Você deixou 10,32 bb na mesa.',
    })
  })

  it('erro sem fold: sem EV deixado, mas com o EV da ação certa', () => {
    expect(veredito('bb-defense-bb-vs-utg-regular', 'KQo', 'raise').body).toBe(
      'Você escolheu 3bet; a ação certa é Call. EV da ação certa: 0,47 bb.',
    )
  })

  it('fold correto não afirma EV: a planilha escreve EV em mãos de fold, mas o fold vale zero', () => {
    expect(veredito('rfi-utg-regular', 'K8s', 'fold')).toMatchObject({
      title: 'K8s é fold neste spot',
      body: 'Você escolheu Fold e acertou.',
    })
    expect(veredito('vs-4bet-bb-vs-sb-regular', 'AJo', 'fold').body).toBe('Você escolheu Fold e acertou.')
  })

  it('contra fish: avisa que a planilha não traz EV nesses spots, no acerto e no erro', () => {
    expect(veredito('rfi-btn-fish', 'AA', 'fold').body).toBe(
      'Você escolheu Fold; a ação certa é Open. Sem EV para este spot: a planilha não traz EV nos spots contra fish.',
    )
    expect(veredito('rfi-btn-fish', 'AA', 'raise').body).toBe(
      'Você escolheu Open e acertou. Sem EV para este spot: a planilha não traz EV nos spots contra fish.',
    )
  })

  it('mão de borda: acrescenta o aviso, sem afirmar EV', () => {
    expect(veredito('rfi-utg-regular', 'A2s', 'raise').body).toBe(
      'Você escolheu Open e acertou. Mão de borda: a planilha não traz EV, e a frequência real pode ser mista.',
    )
    expect(veredito('rfi-utg-regular', 'A2s', 'fold').body).toBe(
      'Você escolheu Fold; a ação certa é Open. Mão de borda: a planilha não traz EV, e a frequência real pode ser mista.',
    )
  })
})

describe('nomes de exibição', () => {
  it('raise é Open no RFI, 3bet no 3bet e na defesa do BB, e 4bet no vs 3bet; jam é Jam', () => {
    expect(veredito('rfi-utg-regular', 'AA', 'raise').title).toBe('AA é open neste spot')
    expect(veredito('3bet-co-vs-utg-regular', 'AA', 'raise').title).toBe('AA é 3bet neste spot')
    expect(veredito('bb-defense-bb-vs-utg-regular', 'AA', 'raise').title).toBe('AA é 3bet neste spot')
    expect(veredito('vs-3bet-utg-vs-bb-regular', 'AA', 'raise').title).toBe('AA é 4bet neste spot')
    expect(veredito('vs-4bet-bb-vs-btn-regular', 'AA', 'jam').title).toBe('AA é jam neste spot')
    expect(veredito('vs-jam-btn-vs-bb-regular', 'AA', 'call').title).toBe('AA é call neste spot')
  })

  it('o texto usa os mesmos nomes dos botões da pergunta', () => {
    const violacoes = dados.spots.flatMap((s) => {
      const p = perguntaDe(s.id, s.hands.find((h) => h.action !== 'out_of_range')!.hand)
      const v = avaliar(dados, p, p.options[0]!.action)
      const nomes = p.options.map((o) => o.label)
      return nomes.some((n) => v.title.includes(n.toLowerCase()) || v.body.includes(n)) ? [] : [`${s.id}: nenhum nome de botão no texto`]
    })
    expect(violacoes).toEqual([])
  })
})

describe('texto × campos estruturados', () => {
  // O texto só afirma o que os campos dizem, e os campos continuam separados do texto.
  it('em todas as 127 abas, cada frase aparece se, e só se, o campo correspondente existe', () => {
    const violacoes: string[] = []
    for (const spot of dados.spots) {
      for (const mao of spot.hands.filter((h) => h.action !== 'out_of_range')) {
        const p = perguntaDe(spot.id, mao.hand)
        for (const { action } of p.options) {
          const v = avaliar(dados, p, action)
          const onde = `${spot.id}: ${mao.hand} com ${action}`
          const tem = (trecho: string) => v.body.includes(trecho)
          if (tem('EV da ação certa') !== (v.ev !== null)) violacoes.push(`${onde}: frase do EV não bate com ev=${v.ev}`)
          if (tem('na mesa') !== (v.evLeft !== null)) violacoes.push(`${onde}: frase do EV deixado não bate com evLeft=${v.evLeft}`)
          if (tem('Sem EV para este spot') !== (v.villainType === 'fish')) violacoes.push(`${onde}: aviso de fish errado`)
          if (tem('Mão de borda') !== v.edgeHand) violacoes.push(`${onde}: aviso de borda errado`)
          if (tem('acertou') !== v.correct) violacoes.push(`${onde}: frase de acerto errada`)
          if (v.ev !== null && !tem(`${String(v.ev).replace('.', ',')} bb`)) violacoes.push(`${onde}: o EV escrito não é ${v.ev}`)
          if (!/^[^ ]+ é [^ ]+ neste spot$/.test(v.title) || !v.title.startsWith(mao.hand + ' é ')) violacoes.push(`${onde}: título fora do formato`)
        }
      }
    }
    expect(violacoes).toEqual([])
  })
})
