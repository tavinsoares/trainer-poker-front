import { describe, expect, it } from 'vitest'
import type { Spot } from '../../src/data/ranges-types.ts'
import {
  criarSessao,
  encerrar,
  limparFiltros,
  motivoSemSpot,
  mudarFiltros,
  novaSessao,
  numeroDaPergunta,
  proxima,
  responder,
  resumo,
  spotDaPergunta,
  type Dependencias,
  type Sessao,
} from '../../src/domain/sessao.ts'
import type { AnswerableAction } from '../../src/domain/tipos.ts'
import { constante, dados, prng } from './auxiliares.ts'

// Spec 4: a sessão do drill. Único seam: operações sobre a sessão (e, depois, a visão dela), com
// rng, relógio e gerador de id injetados e os dados reais.

const deps = (rng = prng(7)): Dependencias => {
  let n = 0
  return { dados, rng, agora: () => `2026-11-16T10:00:${String(n).padStart(2, '0')}.000Z`, novoId: () => `sessao-${++n}` }
}

/** A ação certa da pergunta, lida direto dos dados (caminho independente da avaliação). */
const acaoCerta = (s: Sessao): AnswerableAction => {
  const pergunta = s.pergunta
  if (!pergunta) throw new Error('sem pergunta aberta')
  const spot = dados.spots.find((x) => x.id === pergunta.spot.id)
  const mao = spot?.hands.find((h) => h.hand === pergunta.hand.name)
  if (!mao || mao.action === 'out_of_range') throw new Error(`${pergunta.spot.id} ${pergunta.hand.name}: sem ação certa`)
  return mao.action
}

/** Uma ação que é botão da pergunta e não é a certa. */
const acaoErrada = (s: Sessao): AnswerableAction => {
  const certa = acaoCerta(s)
  const outra = s.pergunta?.options.find((o) => o.action !== certa)
  if (!outra) throw new Error('a pergunta só tem a ação certa')
  return outra.action
}

const acertar = (s: Sessao) => responder(s, acaoCerta(s))
const errar = (s: Sessao) => responder(s, acaoErrada(s))

describe('criar a sessão', () => {
  it('traz id novo, contadores zerados e uma pergunta aberta', () => {
    const s = criarSessao(deps())
    expect(s.id).toBe('sessao-1')
    expect(s.estado).toBe('perguntando')
    expect(s.pergunta).not.toBeNull()
    expect(s.veredito).toBeNull()
    expect([s.corretas, s.erros, s.sequencia, s.maiorSequencia, s.respostas.length]).toEqual([0, 0, 0, 0, 0])
  })

  it('começa com o vilão em Ambos e tipo de spot e posição vazios', () => {
    expect(criarSessao(deps()).filtros).toEqual({ vilao: 'ambos', familias: [], posicoes: [] })
  })
})

describe('o ciclo: responder e próxima', () => {
  it('responder certo vai a respondida, com o veredito e os contadores', () => {
    const aberta = criarSessao(deps())
    const s = acertar(aberta)
    expect(s.estado).toBe('respondida')
    expect(s.veredito?.correct).toBe(true)
    expect([s.corretas, s.erros, s.sequencia]).toEqual([1, 0, 1])
    expect(s.pergunta).toBe(aberta.pergunta)
  })

  it('responder errado conta erro e zera a sequência', () => {
    const s = errar(criarSessao(deps()))
    expect(s.veredito?.correct).toBe(false)
    expect([s.corretas, s.erros, s.sequencia]).toEqual([0, 1, 0])
  })

  it('próxima volta a perguntando com outra pergunta, sem mexer nos contadores', () => {
    const respondida = acertar(criarSessao(deps()))
    const s = proxima(respondida)
    expect(s.estado).toBe('perguntando')
    expect(s.veredito).toBeNull()
    expect(s.pergunta).not.toBe(respondida.pergunta)
    expect([s.corretas, s.erros, s.sequencia]).toEqual([1, 0, 1])
  })

  it('segue uma sequência roteirizada: a sequência cresce no acerto, zera no erro, e a maior é guardada', () => {
    const roteiro = ['c', 'c', 'e', 'c', 'c', 'c', 'e'] as const
    let s = criarSessao(deps())
    const sequencias: number[] = []
    for (const passo of roteiro) {
      s = proxima(passo === 'c' ? acertar(s) : errar(s))
      sequencias.push(s.sequencia)
    }
    expect(sequencias).toEqual([1, 2, 0, 1, 2, 3, 0])
    expect([s.corretas, s.erros, s.respostas.length, s.maiorSequencia]).toEqual([5, 2, 7, 3])
  })

  it('a pergunta aberta não conta, e o número da pergunta é o total respondido mais um', () => {
    let s = criarSessao(deps())
    expect(numeroDaPergunta(s)).toBe(1)
    s = acertar(s)
    expect(numeroDaPergunta(s)).toBe(1)
    s = proxima(s)
    expect(s.respostas).toHaveLength(1)
    expect(numeroDaPergunta(s)).toBe(2)
  })
})

describe('operações que não valem não mudam nada', () => {
  it('responder duas vezes a mesma pergunta', () => {
    const respondida = acertar(criarSessao(deps()))
    expect(responder(respondida, 'fold')).toBe(respondida)
  })

  it('responder com uma ação que não é botão da pergunta', () => {
    // O RFI só tem fold e Open: call e jam não são botões.
    const rfi = criarSessao(deps(constante(0)))
    expect(rfi.pergunta?.spot.family).toBe('rfi')
    expect(responder(rfi, 'call')).toBe(rfi)
    expect(responder(rfi, 'jam')).toBe(rfi)
  })

  it('próxima com a pergunta ainda aberta', () => {
    const aberta = criarSessao(deps())
    expect(proxima(aberta)).toBe(aberta)
  })
})

describe('o registro de resposta', () => {
  it('traz todos os campos do veredito, da pergunta e do relógio', () => {
    // rng 0: o primeiro spot regular (RFI do UTG) e a primeira combinação (AA, que é raise com EV 10,32).
    const s = responder(criarSessao(deps(constante(0))), 'fold')
    expect(s.respostas).toHaveLength(1)
    const [r] = s.respostas
    expect(r).toEqual({
      sessionId: 'sessao-1',
      answeredAt: '2026-11-16T10:00:01.000Z',
      spotId: 'rfi-utg-regular',
      family: 'rfi',
      hero: 'UTG',
      villainType: 'regular',
      hand: 'AA',
      cards: s.pergunta?.hand.cards,
      chosenAction: 'fold',
      correctAction: 'raise',
      correct: false,
      ev: 10.32,
      evLeft: 10.32,
      edgeHand: false,
    })
  })

  it('o registro coincide com o veredito em toda resposta de uma sessão longa', () => {
    let s = criarSessao(deps())
    for (let i = 0; i < 300; i++) {
      const respondida = i % 3 === 0 ? errar(s) : acertar(s)
      const r = respondida.respostas.at(-1)!
      const v = respondida.veredito!
      s = proxima(respondida)
      expect([r.correct, r.chosenAction, r.correctAction, r.ev, r.evLeft, r.edgeHand, r.villainType]).toEqual([
        v.correct,
        v.chosenAction,
        v.correctAction,
        v.ev,
        v.evLeft,
        v.edgeHand,
        v.villainType,
      ])
    }
  })
})

describe('o spot completo da pergunta', () => {
  it('é achado pelo id, para a matriz do feedback', () => {
    const s = criarSessao(deps())
    const spot: Spot = spotDaPergunta(s)
    expect(spot.id).toBe(s.pergunta?.spot.id)
    expect(spot.hands).toHaveLength(169)
  })
})

describe('mudar os filtros', () => {
  const dentroDoFiltro = (s: Sessao) => {
    const spot = spotDaPergunta(s)
    const { vilao, familias, posicoes } = s.filtros
    return (
      (vilao === 'ambos' || spot.villain.type === vilao) &&
      (familias.length === 0 || familias.includes(spot.family)) &&
      (posicoes.length === 0 || posicoes.includes(spot.hero))
    )
  }

  it('em respondida mantém o feedback e vale para a próxima pergunta', () => {
    const respondida = acertar(criarSessao(deps()))
    const s = mudarFiltros(respondida, { vilao: 'fish', familias: ['bb-defense'] })
    expect(s.estado).toBe('respondida')
    expect(s.pergunta).toBe(respondida.pergunta)
    expect(s.veredito).toBe(respondida.veredito)
    expect(s.filtros).toEqual({ vilao: 'fish', familias: ['bb-defense'], posicoes: [] })
    const seguinte = proxima(s)
    expect(seguinte.estado).toBe('perguntando')
    expect(dentroDoFiltro(seguinte)).toBe(true)
  })

  it('em perguntando descarta a pergunta aberta sem contar e sorteia outra dentro do filtro', () => {
    const rng = prng(3)
    for (let i = 0; i < 200; i++) {
      const aberta = criarSessao(deps(rng))
      const s = mudarFiltros(aberta, { vilao: 'regular', familias: ['vs-3bet', 'vs-jam'], posicoes: ['UTG', 'HJ'] })
      expect(s.estado).toBe('perguntando')
      expect(s.respostas).toHaveLength(0)
      expect(dentroDoFiltro(s)).toBe(true)
    }
  })

  it('mantém contadores e id da sessão', () => {
    let s = proxima(acertar(criarSessao(deps())))
    s = proxima(errar(s))
    const antes = [s.id, s.corretas, s.erros, s.sequencia, s.respostas.length]
    const depois = mudarFiltros(s, { posicoes: ['BB'] })
    expect([depois.id, depois.corretas, depois.erros, depois.sequencia, depois.respostas.length]).toEqual(antes)
  })

  it('só altera o que veio no parcial', () => {
    const s = mudarFiltros(mudarFiltros(criarSessao(deps()), { vilao: 'fish' }), { posicoes: ['BTN'] })
    expect(s.filtros).toEqual({ vilao: 'fish', familias: [], posicoes: ['BTN'] })
  })
})

describe('quando os filtros não deixam nenhum spot', () => {
  const semSpot = (s = criarSessao(deps())) => mudarFiltros(s, { vilao: 'fish', familias: ['rfi'], posicoes: ['UTG'] })

  it('vai a sem-spot, sem lançar e sem pergunta, e explica a razão', () => {
    const s = semSpot()
    expect(s.estado).toBe('sem-spot')
    expect(s.pergunta).toBeNull()
    expect(motivoSemSpot(s)).toBe('Não há spot contra fish com esses filtros, mas há contra regular.')
  })

  it('a razão é genérica quando nenhum vilão tem o spot', () => {
    const s = mudarFiltros(criarSessao(deps()), { vilao: 'regular', familias: ['rfi'], posicoes: ['BB'] })
    expect(s.estado).toBe('sem-spot')
    expect(motivoSemSpot(s)).toBe('Não há spot com esses filtros.')
  })

  it('não há razão fora do estado sem-spot', () => {
    expect(motivoSemSpot(criarSessao(deps()))).toBeNull()
  })

  it('limpar os filtros sorteia de novo', () => {
    const s = limparFiltros(semSpot())
    expect(s.estado).toBe('perguntando')
    expect(s.filtros).toEqual({ vilao: 'ambos', familias: [], posicoes: [] })
  })

  it('próxima tenta de novo e continua sem-spot enquanto os filtros não mudam', () => {
    const s = semSpot()
    expect(proxima(s).estado).toBe('sem-spot')
  })

  it('ajustar o filtro para algo que existe volta a sortear, e responder sem pergunta não muda nada', () => {
    const s = semSpot()
    expect(responder(s, 'fold')).toBe(s)
    expect(mudarFiltros(s, { posicoes: ['BTN'] }).estado).toBe('perguntando')
  })

  it('mantém contadores e id da sessão', () => {
    const base = proxima(acertar(criarSessao(deps())))
    const s = semSpot(base)
    expect([s.id, s.corretas, s.respostas.length]).toEqual([base.id, 1, 1])
  })
})

describe('encerrar e nova sessão', () => {
  const sessaoDe = (roteiro: ('c' | 'e')[]) => {
    let s = criarSessao(deps())
    for (const passo of roteiro) s = proxima(passo === 'c' ? acertar(s) : errar(s))
    return s
  }

  it('descarta a pergunta aberta sem contar e traz o resumo', () => {
    const s = encerrar(sessaoDe(['c', 'c', 'e', 'c', 'c', 'c', 'e']))
    expect(s.estado).toBe('encerrada')
    expect(s.pergunta).toBeNull()
    expect(s.respostas).toHaveLength(7)
    expect(resumo(s)).toEqual({ respostas: 7, corretas: 5, erros: 2, taxa: 71.4, maiorSequencia: 3 })
  })

  it('encerrar durante o feedback também vale', () => {
    const s = encerrar(acertar(criarSessao(deps())))
    expect(resumo(s)).toEqual({ respostas: 1, corretas: 1, erros: 0, taxa: 100, maiorSequencia: 1 })
  })

  it('sem respostas, a taxa é nula', () => {
    expect(resumo(encerrar(criarSessao(deps())))).toEqual({ respostas: 0, corretas: 0, erros: 0, taxa: null, maiorSequencia: 0 })
  })

  it('depois de encerrada nenhuma operação muda a sessão', () => {
    const s = encerrar(sessaoDe(['c']))
    expect(responder(s, 'fold')).toBe(s)
    expect(proxima(s)).toBe(s)
    expect(mudarFiltros(s, { vilao: 'fish' })).toBe(s)
    expect(encerrar(s)).toBe(s)
  })

  it('nova sessão traz id novo, contadores zerados e os mesmos filtros', () => {
    const encerrada = encerrar(mudarFiltros(sessaoDe(['c', 'e']), { vilao: 'regular', posicoes: ['BB'] }))
    const s = novaSessao(encerrada)
    expect(s.id).not.toBe(encerrada.id)
    expect(s.estado).toBe('perguntando')
    expect([s.corretas, s.erros, s.sequencia, s.maiorSequencia, s.respostas.length]).toEqual([0, 0, 0, 0, 0])
    expect(s.filtros).toEqual({ vilao: 'regular', familias: [], posicoes: ['BB'] })
  })

  it('nova sessão só vale depois de encerrar', () => {
    const aberta = criarSessao(deps())
    expect(novaSessao(aberta)).toBe(aberta)
  })
})
