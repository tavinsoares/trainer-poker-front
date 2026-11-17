import { describe, expect, it } from 'vitest'
import type { RegistroDeResposta } from '../../src/domain/sessao.ts'
import { calcularLeaks, FILTROS_DOS_LEAKS_PADRAO, nomeDoSpot, type FiltrosDosLeaks } from '../../src/domain/leaks.ts'
import { dados, registroDeTeste } from './auxiliares.ts'

const AGORA = '2026-11-16T12:00:00.000Z'

type Mao = Pick<RegistroDeResposta, 'hand' | 'cards'>
const AKS: Mao = { hand: 'AKs', cards: [{ rank: 'A', suit: 's' }, { rank: 'K', suit: 's' }] }
const QQ: Mao = { hand: 'QQ', cards: [{ rank: 'Q', suit: 'h' }, { rank: 'Q', suit: 'd' }] }
const JJ: Mao = { hand: 'JJ', cards: [{ rank: 'J', suit: 'h' }, { rank: 'J', suit: 'd' }] }
const NN: Mao = { hand: '99', cards: [{ rank: '9', suit: 'h' }, { rank: '9', suit: 'd' }] }
const KQO: Mao = { hand: 'KQo', cards: [{ rank: 'K', suit: 'd' }, { rank: 'Q', suit: 's' }] }

/** Um registro de um spot real dos dados, com a família, o Hero e o vilão do próprio spot. */
const doSpot = (spotId: string, parcial: Partial<RegistroDeResposta> = {}): RegistroDeResposta => {
  const spot = dados.spots.find((s) => s.id === spotId)
  if (!spot) throw new Error(`o spot ${spotId} não existe`)
  return registroDeTeste({
    spotId,
    family: spot.family,
    hero: spot.hero,
    villainType: spot.villain.type,
    ev: null,
    ...parcial,
  })
}
const acerto = (spotId: string, parcial: Partial<RegistroDeResposta> = {}) =>
  doSpot(spotId, { chosenAction: 'raise', correctAction: 'raise', correct: true, ...parcial })
/** Fold errado numa mão de ação: contra regular com EV, deixa o EV na mesa. */
const foldComEv = (spotId: string, ev: number, parcial: Partial<RegistroDeResposta> = {}) =>
  doSpot(spotId, { chosenAction: 'fold', correctAction: 'raise', correct: false, ev, evLeft: ev, ...parcial })
/** Erro que não é fold: não deixa EV na mesa. */
const erroSemEv = (spotId: string, parcial: Partial<RegistroDeResposta> = {}) =>
  doSpot(spotId, { chosenAction: 'call', correctAction: 'raise', correct: false, ...parcial })
const vezes = (n: number, fazer: (i: number) => RegistroDeResposta) => Array.from({ length: n }, (_, i) => fazer(i))

const S1 = 'bb-defense-bb-vs-btn-regular' // BB, regular
const S2 = 'vs-4bet-bb-vs-btn-fish' // BB, fish
const S3 = 'rfi-utg-regular' // UTG, regular
const S4 = '3bet-co-vs-utg-regular' // CO, regular
const S5 = 'vs-3bet-co-vs-sb-regular' // CO, regular
const S6 = 'vs-jam-utg-vs-bb-regular' // UTG, regular

// O histórico de referência, escrito à mão: 81 respostas e 40 erros.
//   S1: 12 tentativas, 6 erros (4 folds de A5s... aqui AKs, 2 de KQo) com EV 1,5 e 0,4
//   S2: 10 tentativas, 7 erros (5 JJ, 2 99), contra fish
//   S3: 9 tentativas, 9 erros (abaixo do mínimo)
//   S4: 20 tentativas, 0 erros
//   S5: 10 tentativas, 6 erros (3 AKs, 3 QQ), sem fold
//   S6: 20 tentativas, 12 erros (QQ), sem fold
const historicoDeReferencia = (): RegistroDeResposta[] => [
  ...vezes(6, () => acerto(S1)),
  ...vezes(4, () => foldComEv(S1, 1.5, AKS)),
  ...vezes(2, () => foldComEv(S1, 0.4, KQO)),
  ...vezes(3, () => acerto(S2, { villainType: 'fish' })),
  ...vezes(5, () => erroSemEv(S2, { ...JJ, correctAction: 'jam' })),
  ...vezes(2, () => erroSemEv(S2, { ...NN, correctAction: 'jam' })),
  ...vezes(9, () => erroSemEv(S3)),
  ...vezes(20, () => acerto(S4)),
  ...vezes(4, () => acerto(S5)),
  ...vezes(3, () => erroSemEv(S5, AKS)),
  ...vezes(3, () => erroSemEv(S5, QQ)),
  ...vezes(8, () => acerto(S6)),
  ...vezes(12, () => erroSemEv(S6, QQ)),
]

const leaks = (registros: RegistroDeResposta[], filtros: Partial<FiltrosDosLeaks> = {}) =>
  calcularLeaks(dados, registros, { ...FILTROS_DOS_LEAKS_PADRAO, ...filtros }, AGORA)

describe('leaks: métricas (spec 5, ticket 4)', () => {
  it('conta respostas, corretas, erros, taxa de acerto e o EV deixado somado', () => {
    const { metricas } = leaks(historicoDeReferencia())
    expect(metricas).toEqual({
      respostas: 81,
      corretas: 41,
      erros: 40,
      taxaDeAcerto: 50.6, // 41 / 81
      taxaDeErro: 49.4, // 40 / 81
      evDeixado: 6.8, // 4 x 1,5 + 2 x 0,4, sem ruído de ponto flutuante
      foldsComEv: 6,
    })
  })

  it('arredonda o EV somado a duas casas', () => {
    const registros = [0.1, 0.2, 0.3].map((ev) => foldComEv(S1, ev))
    expect(leaks(registros).metricas.evDeixado).toBe(0.6) // 0,1 + 0,2 + 0,3 em ponto flutuante dá 0,6000000000000001
  })

  it('sem histórico: taxa nula, EV zero e o estado "sem-historico"', () => {
    const r = leaks([])
    expect(r.estado).toBe('sem-historico')
    expect(r.metricas).toEqual({ respostas: 0, corretas: 0, erros: 0, taxaDeAcerto: null, taxaDeErro: null, evDeixado: 0, foldsComEv: 0 })
  })
})

describe('leaks: filtros de vilão e período', () => {
  it('o filtro de vilão vale para as métricas, as barras e a tabela', () => {
    const r = leaks(historicoDeReferencia(), { vilao: 'fish' })
    expect(r.metricas).toMatchObject({ respostas: 10, erros: 7, corretas: 3, evDeixado: 0 })
    expect(r.porVilao.find((l) => l.chave === 'regular')).toMatchObject({ tentativas: 0, taxaDeErro: null })
    expect(r.porPosicao.find((l) => l.chave === 'CO')).toMatchObject({ tentativas: 0 })
    expect(r.spots.map((s) => s.spotId)).toEqual([S2])

    const regulares = leaks(historicoDeReferencia(), { vilao: 'regular' })
    expect(regulares.metricas.respostas).toBe(71)
    expect(regulares.spots.map((s) => s.spotId)).not.toContain(S2)
  })

  const MS_POR_DIA = 24 * 60 * 60 * 1000
  const em = (ms: number) => new Date(Date.parse(AGORA) - ms).toISOString()
  const noTempo = (iso: string) => acerto(S1, { answeredAt: iso })
  const registrosDoTempo = () => [
    noTempo(em(7 * MS_POR_DIA - 1)), // 1 ms dentro dos 7 dias
    noTempo(em(7 * MS_POR_DIA)), // exatamente no limite: dentro (inclusive)
    noTempo(em(7 * MS_POR_DIA + 1)), // 1 ms fora dos 7 dias, dentro dos 30
    noTempo(em(30 * MS_POR_DIA)), // no limite dos 30 dias: dentro
    noTempo(em(30 * MS_POR_DIA + 1)), // 1 ms fora dos 30 dias
    noTempo('2026-12-01T00:00:00.000Z'), // data no futuro: entra em todos os períodos
  ]

  it('7 dias, 30 dias e tudo contam para trás a partir de agora, com o limite incluído', () => {
    const contar = (periodo: FiltrosDosLeaks['periodo']) => leaks(registrosDoTempo(), { periodo }).metricas.respostas
    expect(contar('7d')).toBe(3) // 1 ms dentro, no limite e o do futuro
    expect(contar('30d')).toBe(5) // + a 1 ms fora dos 7 dias e a do limite de 30
    expect(contar('tudo')).toBe(6)
  })

  it('o período vale para as barras e a tabela também', () => {
    const antigos = vezes(10, () => erroSemEv(S6, { ...QQ, answeredAt: em(40 * MS_POR_DIA) }))
    const r = leaks(antigos, { periodo: '30d' })
    expect(r.estado).toBe('sem-respostas-nos-filtros')
    expect(r.spots).toEqual([])
    expect(leaks(antigos, { periodo: 'tudo' }).spots.map((s) => s.spotId)).toEqual([S6])
  })
})

describe('leaks: taxa de erro por vilão, posição e tipo de spot', () => {
  const r = leaks(historicoDeReferencia())
  const linha = (lista: { chave: string }[], chave: string) => lista.find((l) => l.chave === chave)

  it('por vilão, na ordem Regular e Fish', () => {
    expect(r.porVilao.map((l) => [l.chave, l.rotulo])).toEqual([['regular', 'Regular'], ['fish', 'Fish']])
    expect(linha(r.porVilao, 'regular')).toMatchObject({ tentativas: 71, erros: 33, taxaDeErro: 46.5 })
    expect(linha(r.porVilao, 'fish')).toMatchObject({ tentativas: 10, erros: 7, taxaDeErro: 70 })
  })

  it('por posição, de UTG a BB, com taxa nula (e não zero) onde não há respostas', () => {
    expect(r.porPosicao.map((l) => l.chave)).toEqual(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'])
    expect(linha(r.porPosicao, 'UTG')).toMatchObject({ tentativas: 29, erros: 21, taxaDeErro: 72.4 })
    expect(linha(r.porPosicao, 'CO')).toMatchObject({ tentativas: 30, erros: 6, taxaDeErro: 20 })
    expect(linha(r.porPosicao, 'BB')).toMatchObject({ tentativas: 22, erros: 13, taxaDeErro: 59.1 })
    for (const sem of ['HJ', 'BTN', 'SB']) expect(linha(r.porPosicao, sem)).toMatchObject({ tentativas: 0, erros: 0, taxaDeErro: null })
  })

  it('por tipo de spot, na ordem RFI, 3bet, Defesa do BB, vs 3bet, vs 4bet e vs jam', () => {
    expect(r.porFamilia.map((l) => l.rotulo)).toEqual(['RFI', '3bet', 'Defesa do BB', 'vs 3bet', 'vs 4bet', 'vs jam'])
    expect(r.porFamilia.map((l) => l.taxaDeErro)).toEqual([100, 0, 50, 60, 70, 60])
    expect(r.porFamilia.map((l) => l.tentativas)).toEqual([9, 20, 12, 10, 10, 20])
  })
})

describe('leaks: spots com mais erros', () => {
  const r = leaks(historicoDeReferencia())

  it('só entram spots com pelo menos 10 tentativas e 1 erro, ordenados pela taxa de erro com desempates', () => {
    // S3 tem 9 tentativas (abaixo do mínimo) e S4 não tem erros. S6 e S5 empatam em 60%: S6 tem mais erros.
    expect(r.spots.map((s) => s.spotId)).toEqual([S2, S6, S5, S1])
    expect(r.spots.map((s) => s.taxaDeErro)).toEqual([70, 60, 60, 50])
  })

  it('cada linha traz o nome, o vilão, as tentativas, os erros, a mão mais errada e o EV deixado', () => {
    expect(r.spots.find((s) => s.spotId === S1)).toMatchObject({
      nome: 'BB vs open do BTN',
      vilao: 'regular',
      tentativas: 12,
      erros: 6,
      maoMaisErrada: 'AKs', // 4 folds de AKs contra 2 de KQo
      evDeixado: 6.8,
      familia: 'bb-defense',
      hero: 'BB',
    })
  })

  it('a mão mais errada desempata pelo nome da mão', () => {
    expect(r.spots.find((s) => s.spotId === S5)?.maoMaisErrada).toBe('AKs') // AKs e QQ com 3 erros cada
  })

  it('o EV deixado é nulo contra fish e zero contra regular quando nenhum fold deixou EV', () => {
    expect(r.spots.find((s) => s.spotId === S2)).toMatchObject({ vilao: 'fish', evDeixado: null, maoMaisErrada: 'JJ' })
    expect(r.spots.find((s) => s.spotId === S5)?.evDeixado).toBe(0)
  })

  it('mostra no máximo 10 linhas', () => {
    const ids = dados.spots.filter((s) => s.villain.type === 'regular').slice(0, 12).map((s) => s.id)
    const registros = ids.flatMap((id) => [...vezes(5, () => acerto(id)), ...vezes(5, () => erroSemEv(id))])
    const tabela = leaks(registros).spots
    expect(tabela).toHaveLength(10)
    // Todos com 50%, 5 erros e 10 tentativas: o desempate final é o id do spot.
    expect(tabela.map((s) => s.spotId)).toEqual([...ids].sort().slice(0, 10))
  })

  it('um spot que não existe mais nos dados fica fora da tabela e conta à parte, mas continua nas métricas', () => {
    const sumido = vezes(12, () => erroSemEv(S1, { spotId: 'spot-que-sumiu' }))
    const r2 = leaks([...historicoDeReferencia(), ...sumido])
    expect(r2.spots.map((s) => s.spotId)).not.toContain('spot-que-sumiu')
    expect(r2.registrosForaDaTabela).toBe(12)
    expect(r2.metricas.respostas).toBe(81 + 12)
    expect(r2.porPosicao.find((l) => l.chave === 'BB')?.tentativas).toBe(22 + 12)
    expect(leaks(historicoDeReferencia()).registrosForaDaTabela).toBe(0)
  })
})

describe('leaks: estados vazios', () => {
  it('distingue sem histórico, sem respostas nos filtros e tabela sem spot no mínimo', () => {
    expect(leaks([]).estado).toBe('sem-historico')

    const soFish = [acerto(S2, { villainType: 'fish' })]
    expect(leaks(soFish, { vilao: 'regular' }).estado).toBe('sem-respostas-nos-filtros')

    const poucas = [erroSemEv(S1), erroSemEv(S1)]
    const r = leaks(poucas)
    expect(r.estado).toBe('ok')
    expect(r.spots).toEqual([])
    expect(r.metricas.respostas).toBe(2)
  })
})

describe('leaks: o nome do spot', () => {
  const nome = (id: string) => nomeDoSpot(dados.spots.find((s) => s.id === id)!)

  it('tem um formato por família, conferido contra a spec 2', () => {
    expect(nome('rfi-utg-regular')).toBe('UTG abre (RFI)')
    expect(nome('rfi-btn-fish')).toBe('BTN abre (RFI)')
    expect(nome('3bet-co-vs-utg-regular')).toBe('CO 3bet vs open do UTG')
    expect(nome('bb-defense-bb-vs-btn-regular')).toBe('BB vs open do BTN')
    expect(nome('vs-3bet-co-vs-sb-regular')).toBe('CO vs 3bet do SB')
    expect(nome('vs-4bet-bb-vs-btn-fish')).toBe('BB vs 4bet do BTN')
    expect(nome('vs-jam-utg-vs-bb-regular')).toBe('UTG vs jam do BB')
  })

  it('nenhum dos 127 spots tem nome vazio, "undefined" ou "NaN"', () => {
    expect(dados.spots).toHaveLength(127)
    for (const spot of dados.spots) {
      const n = nomeDoSpot(spot)
      expect(n.length, spot.id).toBeGreaterThan(3)
      expect(n, spot.id).not.toMatch(/undefined|NaN|null/)
    }
  })
})
