import { describe, expect, it } from 'vitest'
import { criarSessao, mudarFiltros, proxima, responder, teclar, type Sessao } from '../../src/domain/sessao.ts'
import { visaoDaPergunta, visaoDoFeedback } from '../../src/domain/visao.ts'
import { dados, depsDeSessao, primeiraMao, sessaoDe } from './auxiliares.ts'

// Spec 4, tickets 3 e 4: a visão que a tela desenha e as teclas. Mesmo seam da sessão.

const visao = (spotId: string, mao = primeiraMao(spotId)) => visaoDaPergunta(sessaoDe(spotId, mao))

const assentos = (spotId: string) => visao(spotId).assentos.map((a) => `${a.position}:${a.titulo}:${a.detalhe}`)

describe('a visão da pergunta: exemplos conferidos contra a spec 2', () => {
  it('defesa do BB contra o open do BTN', () => {
    const v = visao('bb-defense-bb-vs-btn-regular')
    expect(v.rotulo).toBe('SPOT 1 · DEFESA DO BB')
    expect(v.vilao).toEqual({ tipo: 'regular', rotulo: 'Vilão: regular' })
    expect(v.titulo).toBe('Você está no BB. O BTN abre para 2,5bb.')
    expect(v.chips.map((c) => c.texto)).toEqual(['Pote: 4bb', 'A pagar: 1,5bb', 'Stack efetivo: 100bb'])
    expect(v.botoes).toEqual([
      { action: 'fold', nome: 'Fold', atalho: 'F', subtitulo: 'Abandona o pote' },
      { action: 'call', nome: 'Call', atalho: 'C', subtitulo: 'Paga 1,5bb' },
      { action: 'raise', nome: '3bet', atalho: 'R', subtitulo: 'Re-aumenta para 13bb' },
    ])
    expect(v.assentos.map((a) => `${a.position}:${a.titulo}:${a.detalhe}`)).toEqual([
      'UTG:UTG:fold',
      'HJ:HJ:fold',
      'CO:CO:fold',
      'BTN:BTN:open 2,5bb',
      'SB:SB:fold',
      'BB:BB · você:100bb · 1bb posto',
    ])
  })

  it('3bet do CO contra o open do UTG: quem vem depois do Hero aguarda', () => {
    const v = visao('3bet-co-vs-utg-regular')
    expect(v.chips.map((c) => c.texto)).toEqual(['Pote: 3,5bb', 'A pagar: 2bb', 'Stack efetivo: 100bb'])
    expect(assentos('3bet-co-vs-utg-regular')).toEqual([
      'UTG:UTG:open 2bb',
      'HJ:HJ:fold',
      'CO:CO · você:100bb',
      'BTN:BTN:aguardando',
      'SB:SB:aguardando',
      'BB:BB:aguardando',
    ])
  })

  it('vs jam: a história inteira no título, o 4bet estimado com "~", só fold e call', () => {
    const v = visao('vs-jam-btn-vs-bb-regular')
    expect(v.titulo).toBe('Você abriu para 2,5bb no BTN. O BB dá 3bet para 13bb, você dá 4bet para ~26bb e o BB dá jam de 100bb.')
    expect(v.chips.map((c) => c.texto)).toEqual(['Pote: ~126,5bb', 'A pagar: ~74bb', 'Stack efetivo: 100bb'])
    expect(v.botoes.map((b) => [b.nome, b.atalho, b.subtitulo])).toEqual([
      ['Fold', 'F', 'Abandona o pote'],
      ['Call', 'C', 'Paga ~74bb'],
    ])
    expect(assentos('vs-jam-btn-vs-bb-regular')).toEqual([
      'UTG:UTG:fold',
      'HJ:HJ:fold',
      'CO:CO:fold',
      'BTN:BTN · você:100bb · ~26bb posto',
      'SB:SB:fold',
      'BB:BB:jam 100bb',
    ])
  })

  it('vs jam do UTG contra o BB: o 4bet de ~23bb (19 + 4 contra o BB) aparece no título', () => {
    expect(visao('vs-jam-utg-vs-bb-regular').titulo).toBe(
      'Você abriu para 2bb no UTG. O BB dá 3bet para 12bb, você dá 4bet para ~23bb e o BB dá jam de 100bb.',
    )
  })

  it('vs 4bet: a história inteira no título, e o botão de jam em vez de raise', () => {
    const v = visao('vs-4bet-bb-vs-btn-regular')
    expect(v.titulo).toBe('O BTN abre para 2,5bb, você dá 3bet para 13bb no BB e o BTN dá 4bet para 27bb.')
    expect(v.chips.map((c) => c.texto)).toEqual(['Pote: 40,5bb', 'A pagar: 14bb', 'Stack efetivo: 100bb'])
    expect(v.botoes.map((b) => [b.nome, b.atalho, b.subtitulo])).toEqual([
      ['Fold', 'F', 'Abandona o pote'],
      ['Call', 'C', 'Paga 14bb'],
      ['Jam', 'J', 'Aposta os 100bb'],
    ])
  })

  it('RFI do UTG: sem valor a pagar, e o UTG é o primeiro a agir', () => {
    const v = visao('rfi-utg-regular')
    expect(v.titulo).toBe('Você está no UTG. Você é o primeiro a agir.')
    expect(v.chips.map((c) => c.texto)).toEqual(['Pote: 1,5bb', 'Stack efetivo: 100bb'])
    expect(v.botoes).toEqual([
      { action: 'fold', nome: 'Fold', atalho: 'F', subtitulo: 'Abandona o pote' },
      { action: 'raise', nome: 'Open', atalho: 'R', subtitulo: 'Abre para 2bb' },
    ])
    expect(assentos('rfi-utg-regular').slice(1)).toEqual([
      'HJ:HJ:aguardando',
      'CO:CO:aguardando',
      'BTN:BTN:aguardando',
      'SB:SB:aguardando',
      'BB:BB:aguardando',
    ])
  })

  it('RFI do BTN: todos deram fold até o Hero', () => {
    expect(visao('rfi-btn-regular').titulo).toBe('Você está no BTN. Todos deram fold até você.')
  })

  it('vs 3bet com jam na planilha: o botão de jam existe só nesse spot', () => {
    const v = visao('vs-3bet-hj-vs-co-regular')
    expect(v.titulo).toBe('Você abriu para 2bb no HJ. O CO dá 3bet para 6,5bb.')
    expect(v.botoes.map((b) => [b.nome, b.atalho, b.subtitulo])).toEqual([
      ['Fold', 'F', 'Abandona o pote'],
      ['Call', 'C', 'Paga 4,5bb'],
      ['4bet', 'R', 'Re-aumenta para 19bb'],
      ['Jam', 'J', 'Aposta os 100bb'],
    ])
    expect(visao('vs-3bet-utg-vs-hj-regular').botoes.map((b) => b.atalho)).toEqual(['F', 'C', 'R'])
  })

  it('contra fish, o tamanho estimado leva "~" no título, nos chips, na mesa e nos botões', () => {
    const v = visao('vs-3bet-utg-vs-hj-fish')
    expect(v.vilao).toEqual({ tipo: 'fish', rotulo: 'Vilão: fish' })
    expect(v.titulo).toBe('Você abriu para ~2bb no UTG. O HJ dá 3bet para ~6,5bb.')
    expect(v.chips.map((c) => c.texto)).toEqual(['Pote: ~10bb', 'A pagar: ~4,5bb', 'Stack efetivo: 100bb'])
    expect(assentos('vs-3bet-utg-vs-hj-fish').slice(0, 2)).toEqual(['UTG:UTG · você:100bb · ~2bb posto', 'HJ:HJ:3bet ~6,5bb'])
    expect(v.botoes.at(-1)?.subtitulo).toBe('Re-aumenta para ~19bb')
  })

  it('RFI contra fish não tem posição de vilão no título', () => {
    const v = visao('rfi-btn-fish')
    expect(v.titulo).toBe('Você está no BTN. Todos deram fold até você.')
    expect(v.vilao.rotulo).toBe('Vilão: fish')
    expect(v.botoes.at(-1)?.subtitulo).toBe('Abre para ~2,5bb')
  })

  it('o número da pergunta acompanha a sessão', () => {
    const s = proxima(responder(sessaoDe('rfi-utg-regular', 'AA'), 'raise'))
    const v = visaoDaPergunta(s)
    expect(v.numero).toBe(2)
    expect(v.rotulo).toBe(`SPOT 2 · ${v.familia.toUpperCase()}`)
  })
})

describe('a mão', () => {
  it('traz as duas cartas com naipe e cor: vermelho em copas e ouros', () => {
    const { mao } = visao('rfi-utg-regular', 'AKs')
    expect(mao.nome).toBe('AKs')
    const [a, b] = mao.cartas
    expect([a.rank, b.rank]).toEqual(['A', 'K'])
    expect(a.naipe).toBe(b.naipe)
    expect(a.simbolo).toBe({ s: '♠', h: '♥', d: '♦', c: '♣' }[a.naipe])
    expect(a.vermelho).toBe(a.naipe === 'h' || a.naipe === 'd')
  })
})

describe('as teclas', () => {
  const tecla = (s: Sessao, key: string, extra: object = {}) => teclar(s, { key, ...extra })
  const bb = () => sessaoDe('bb-defense-bb-vs-btn-regular', 'AKs')

  it.each([
    ['f', 'fold'],
    ['F', 'fold'],
    ['c', 'call'],
    ['C', 'call'],
    ['r', 'raise'],
    ['R', 'raise'],
  ])('%s responde %s quando é botão', (key, acao) => {
    const s = tecla(bb(), key)
    expect(s.estado).toBe('respondida')
    expect(s.veredito?.chosenAction).toBe(acao)
  })

  it('J responde jam no vs 3bet em que a planilha tem jam', () => {
    expect(tecla(sessaoDe('vs-3bet-hj-vs-co-regular', 'AKo'), 'j').veredito?.chosenAction).toBe('jam')
  })

  it('tecla sem botão na situação é ignorada', () => {
    const rfi = sessaoDe('rfi-utg-regular', 'AA')
    expect(tecla(rfi, 'c')).toBe(rfi)
    expect(tecla(rfi, 'j')).toBe(rfi)
    const jam = sessaoDe('vs-jam-btn-vs-bb-regular', 'AA')
    expect(tecla(jam, 'r')).toBe(jam)
    const utg = sessaoDe('vs-3bet-utg-vs-hj-regular', 'AA')
    expect(tecla(utg, 'j')).toBe(utg)
  })

  it('outras teclas são ignoradas', () => {
    const s = bb()
    for (const key of ['x', ' ', 'Escape', 'Tab', '1']) expect(tecla(s, key)).toBe(s)
  })

  it('Ctrl, Alt e Meta não disparam, nem a tecla repetida', () => {
    const s = bb()
    expect(tecla(s, 'r', { ctrlKey: true })).toBe(s)
    expect(tecla(s, 'f', { altKey: true })).toBe(s)
    expect(tecla(s, 'c', { metaKey: true })).toBe(s)
    expect(tecla(s, 'f', { repeat: true })).toBe(s)
  })

  it('Enter só vale depois da resposta e vai à próxima pergunta', () => {
    const aberta = bb()
    expect(tecla(aberta, 'Enter')).toBe(aberta)
    const respondida = tecla(aberta, 'f')
    const seguinte = tecla(respondida, 'Enter')
    expect(seguinte.estado).toBe('perguntando')
    expect(seguinte.pergunta).not.toBe(aberta.pergunta)
  })

  it('depois da resposta, as letras não respondem de novo', () => {
    const respondida = tecla(bb(), 'f')
    expect(tecla(respondida, 'c')).toBe(respondida)
  })

  it('Enter em sem-spot não faz nada', () => {
    const s = mudarFiltros(criarSessao(depsDeSessao()), { vilao: 'fish', familias: ['rfi'], posicoes: ['UTG'] })
    expect(tecla(s, 'Enter')).toBe(s)
  })
})

describe('varredura dos 127 spots', () => {
  const textos = (valor: unknown): string[] =>
    typeof valor === 'string'
      ? [valor]
      : valor && typeof valor === 'object'
        ? Object.values(valor).flatMap(textos)
        : valor === undefined || (typeof valor === 'number' && Number.isNaN(valor))
          ? ['<indefinido>']
          : []

  it('a visão da pergunta não tem undefined, NaN nem texto vazio, e todo botão tem atalho', () => {
    const erros: string[] = []
    for (const spot of dados.spots) {
      const v = visao(spot.id)
      for (const texto of textos(v)) {
        if (texto === '' || /undefined|NaN|<indefinido>/.test(texto)) erros.push(`${spot.id}: texto inválido "${texto}"`)
      }
      for (const b of v.botoes) if (!/^[FCRJ]$/.test(b.atalho)) erros.push(`${spot.id}: botão ${b.nome} sem atalho`)
      if (v.assentos.length !== 6) erros.push(`${spot.id}: ${v.assentos.length} assentos`)
      if (v.assentos.filter((a) => a.estado === 'hero').length !== 1) erros.push(`${spot.id}: não há um só Hero`)
    }
    expect(erros).toEqual([])
  })

  it('os botões são os da cena do domínio (spec 2), na ordem fold, call, raise, jam', () => {
    const erros: string[] = []
    for (const spot of dados.spots) {
      const s = sessaoDe(spot.id, primeiraMao(spot.id))
      const doDominio = s.pergunta!.options.map((o) => o.action)
      const daVisao = visaoDaPergunta(s).botoes.map((b) => b.action)
      if (doDominio.join() !== daVisao.join()) erros.push(`${spot.id}: ${daVisao.join()} em vez de ${doDominio.join()}`)
    }
    expect(erros).toEqual([])
  })
})

describe('a visão do feedback', () => {
  const NOTA_REGULAR = 'O EV vem da planilha e só existe em spots contra regular.'
  const responderCom = (spotId: string, mao: string, acao: 'fold' | 'call' | 'raise' | 'jam') =>
    visaoDoFeedback(responder(sessaoDe(spotId, mao), acao))

  it('só existe depois da resposta', () => {
    expect(() => visaoDoFeedback(sessaoDe('rfi-utg-regular', 'AA'))).toThrow(/respondida/)
  })

  it('acerto com EV: resultado, título, EV da ação certa e do fold, e a nota', () => {
    const f = responderCom('rfi-utg-regular', 'AA', 'raise')
    expect([f.correta, f.resultado, f.mao.nome, f.escolhida, f.certa]).toEqual([true, 'CORRETA', 'AA', 'Open', 'Open'])
    expect(f.titulo).toBe('AA é open neste spot')
    expect(f.corpo).toContain('Você escolheu Open e acertou.')
    expect(f.ev).toEqual({
      tipo: 'regular',
      linhas: [
        { rotulo: 'Open com AA', valor: '+10,32 bb' },
        { rotulo: 'Fold', valor: '0 bb' },
      ],
      deixou: null,
      aviso: null,
      nota: NOTA_REGULAR,
    })
  })

  it('fold errado numa mão com EV: mostra quanto ficou na mesa', () => {
    const f = responderCom('rfi-utg-regular', 'AA', 'fold')
    expect([f.correta, f.resultado, f.escolhida, f.certa]).toEqual([false, 'ERRO', 'Fold', 'Open'])
    expect(f.ev).toMatchObject({ tipo: 'regular', deixou: 'Você deixou 10,32 bb na mesa.' })
  })

  it('call no lugar do raise é erro sem EV deixado, com os nomes dos botões', () => {
    const f = responderCom('bb-defense-bb-vs-btn-regular', 'A5s', 'call')
    expect([f.resultado, f.escolhida, f.certa]).toEqual(['ERRO', 'Call', '3bet'])
    expect(f.ev).toMatchObject({ tipo: 'regular', deixou: null })
  })

  it('mão de borda: o aviso no lugar do número da ação certa', () => {
    const f = responderCom('rfi-utg-regular', 'A2s', 'raise')
    expect(f.ev).toEqual({
      tipo: 'regular',
      linhas: [{ rotulo: 'Fold', valor: '0 bb' }],
      deixou: null,
      aviso: 'Mão de borda: a planilha não traz EV, e a frequência real pode ser mista.',
      nota: NOTA_REGULAR,
    })
  })

  it('ação certa fold: só o fold a 0, sem EV deixado', () => {
    const f = responderCom('rfi-utg-regular', '72o', 'fold')
    expect([f.correta, f.certa]).toEqual([true, 'Fold'])
    expect(f.ev).toEqual({ tipo: 'regular', linhas: [{ rotulo: 'Fold', valor: '0 bb' }], deixou: null, aviso: null, nota: NOTA_REGULAR })
  })

  it('o fold com EV positivo da planilha (AJo no vs 4bet do BB contra o SB) não vira número', () => {
    const f = responderCom('vs-4bet-bb-vs-sb-regular', 'AJo', 'fold')
    expect(f.ev).toMatchObject({ tipo: 'regular', linhas: [{ rotulo: 'Fold', valor: '0 bb' }], deixou: null })
  })

  it('contra fish: a mensagem no lugar do bloco de EV', () => {
    const f = responderCom('bb-defense-bb-vs-btn-fish', 'AA', 'fold')
    expect(f.ev).toEqual({ tipo: 'fish', mensagem: 'Sem EV para este spot. A planilha não traz EV nos spots contra fish.' })
    expect(f.pergunta.vilao.tipo).toBe('fish')
  })

  it('traz o spot completo, a mão em foco, a nota do contorno e a procedência para a matriz', () => {
    const f = responderCom('bb-defense-bb-vs-btn-regular', 'A5s', 'fold')
    expect(f.spot.id).toBe('bb-defense-bb-vs-btn-regular')
    expect(f.spot.hands).toHaveLength(169)
    expect(f.maoEmFoco).toBe('A5s')
    expect(f.notaDaMatriz).toBe('Contorno branco: A5s, a mão deste spot.')
    expect(f.procedencia).toBe(`Fonte: ${dados.manifest.source} · importado em 14/11/2026`)
  })

  it('traz também a visão da pergunta (cabeçalho, mesa e mão)', () => {
    const f = responderCom('bb-defense-bb-vs-btn-regular', 'A5s', 'fold')
    expect(f.pergunta.rotulo).toBe('SPOT 1 · DEFESA DO BB')
    expect(f.pergunta.mao.nome).toBe('A5s')
  })

  // O resultado diz qual é o spot (Hero x vilão - tipo); o drill não, para não entregar o tipo antes da resposta.
  it.each([
    ['bb-defense-bb-vs-btn-regular', 'SPOT 1 · BBxBTN - Defesa do BB'],
    ['3bet-co-vs-utg-regular', 'SPOT 1 · COxUTG - 3bet'],
    ['vs-3bet-utg-vs-bb-regular', 'SPOT 1 · UTGxBB - vs 3bet'],
    ['vs-4bet-bb-vs-btn-regular', 'SPOT 1 · BBxBTN - vs 4bet'],
    ['vs-jam-btn-vs-bb-regular', 'SPOT 1 · BTNxBB - vs jam'],
    ['bb-defense-bb-vs-btn-fish', 'SPOT 1 · BBxBTN - Defesa do BB'],
  ])('o rótulo do resultado de %s é "%s"', (spotId, rotulo) => {
    expect(responderCom(spotId, primeiraMao(spotId), 'fold').rotulo).toBe(rotulo)
  })

  it('no RFI não há vilão: o rótulo do resultado é só o Hero e o tipo', () => {
    expect(responderCom('rfi-utg-regular', 'AA', 'fold').rotulo).toBe('SPOT 1 · UTG - RFI')
    expect(responderCom('rfi-btn-fish', primeiraMao('rfi-btn-fish'), 'fold').rotulo).toBe('SPOT 1 · BTN - RFI')
  })

  it('o rótulo do resultado acompanha o número do spot', () => {
    const segunda = responder(proxima(responder(sessaoDe('rfi-utg-regular', 'AA'), 'raise')), 'fold')
    expect(visaoDoFeedback(segunda).rotulo).toMatch(/^SPOT 2 · /)
  })

  it('o rótulo da pergunta, no drill, continua o de antes: número e família', () => {
    expect(visao('vs-jam-btn-vs-bb-regular').rotulo).toBe('SPOT 1 · VS JAM')
  })

  it('para os 127 spots, uma resposta certa e uma errada não têm undefined, NaN nem texto vazio', () => {
    const erros: string[] = []
    const textos = (valor: unknown): string[] =>
      typeof valor === 'string'
        ? [valor]
        : valor && typeof valor === 'object'
          ? Object.values(valor).flatMap(textos)
          : valor === undefined || (typeof valor === 'number' && Number.isNaN(valor))
            ? ['<indefinido>']
            : []
    for (const spot of dados.spots) {
      const s = sessaoDe(spot.id, primeiraMao(spot.id))
      const certa = spot.hands.find((h) => h.hand === s.pergunta!.hand.name)!.action as 'fold' | 'call' | 'raise' | 'jam'
      const errada = s.pergunta!.options.find((o) => o.action !== certa)!.action
      for (const acao of [certa, errada]) {
        const { spot: _spot, ...resto } = visaoDoFeedback(responder(s, acao))
        for (const texto of textos(resto)) {
          if (texto === '' || /undefined|NaN|<indefinido>/.test(texto)) erros.push(`${spot.id} (${acao}): texto inválido "${texto}"`)
        }
      }
    }
    expect(erros).toEqual([])
  })
})
