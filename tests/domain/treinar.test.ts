import { describe, expect, it } from 'vitest'
import {
  criarSessao,
  encerrar,
  mudarFiltros,
  responder,
  treinar,
  type Sessao,
} from '../../src/domain/sessao.ts'
import { depsDeSessao, prng } from './auxiliares.ts'

// Spec 5: "Treinar" a partir dos leaks. Seam da sessão (spec 4).

const ALVO = { vilao: 'fish', familia: 'vs-4bet', hero: 'BB' } as const

const noFiltro = (s: Sessao) =>
  s.pergunta?.spot.family === ALVO.familia && s.pergunta.spot.hero === ALVO.hero && s.deps.dados.spots.find((x) => x.id === s.pergunta?.spot.id)?.villain.type === ALVO.vilao

const respondida = (): Sessao => {
  const s = criarSessao(depsDeSessao(prng(3)))
  return responder(s, s.pergunta!.options[0]!.action)
}

describe('treinar um spot dos leaks (spec 5, ticket 6)', () => {
  it('em respondida: descarta o feedback e abre uma pergunta nova dentro do filtro, sem mexer no id nem nos contadores', () => {
    const antes = respondida()
    const depois = treinar(antes, ALVO)
    expect(depois.estado).toBe('perguntando')
    expect(depois.veredito).toBeNull()
    expect(noFiltro(depois)).toBe(true)
    expect(depois.filtros).toEqual({ vilao: 'fish', familias: ['vs-4bet'], posicoes: ['BB'] })
    expect(depois.id).toBe(antes.id)
    expect([depois.corretas, depois.erros, depois.respostas.length]).toEqual([antes.corretas, antes.erros, antes.respostas.length])
  })

  it('em perguntando: troca a pergunta aberta por outra dentro do filtro, sem contar a descartada', () => {
    const antes = criarSessao(depsDeSessao(prng(5)))
    const depois = treinar(antes, ALVO)
    expect(depois.estado).toBe('perguntando')
    expect(noFiltro(depois)).toBe(true)
    expect(depois.respostas).toHaveLength(0)
    expect(depois.id).toBe(antes.id)
  })

  it('em sem-spot: tenta de novo com o filtro do spot e abre uma pergunta', () => {
    const semSpot = mudarFiltros(criarSessao(depsDeSessao(prng(5))), { vilao: 'fish', familias: ['rfi'], posicoes: ['UTG'] })
    expect(semSpot.estado).toBe('sem-spot')
    const depois = treinar(semSpot, ALVO)
    expect(depois.estado).toBe('perguntando')
    expect(noFiltro(depois)).toBe(true)
  })

  it('em encerrada: começa uma sessão nova, com id novo, contadores zerados e o filtro do spot', () => {
    const encerrada = encerrar(respondida())
    expect(encerrada.estado).toBe('encerrada')
    const depois = treinar(encerrada, ALVO)
    expect(depois.estado).toBe('perguntando')
    expect(depois.id).not.toBe(encerrada.id)
    expect([depois.corretas, depois.erros, depois.sequencia, depois.respostas.length]).toEqual([0, 0, 0, 0])
    expect(noFiltro(depois)).toBe(true)
    expect(depois.filtros).toEqual({ vilao: 'fish', familias: ['vs-4bet'], posicoes: ['BB'] })
  })

  it('cada alvo existente nos dados devolve uma pergunta aberta (nenhum cai em sem-spot)', () => {
    const base = criarSessao(depsDeSessao(prng(1)))
    for (const spot of base.deps.dados.spots) {
      const depois = treinar(base, { vilao: spot.villain.type, familia: spot.family, hero: spot.hero })
      expect(depois.estado, spot.id).toBe('perguntando')
    }
  })
})
