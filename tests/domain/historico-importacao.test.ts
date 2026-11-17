import { describe, expect, it } from 'vitest'
import {
  acrescentar,
  carregarHistorico,
  CHAVE_DO_HISTORICO,
  exportarHistorico,
  lerImportacao,
  marcarBackup,
  substituirHistorico,
} from '../../src/domain/historico.ts'
import { responder } from '../../src/domain/sessao.ts'
import { armazenamentoEmMemoria, dados, primeiraMao, registroDeTeste, sessaoDe } from './auxiliares.ts'

const AGORA = '2026-11-16T12:00:00.000Z'
const contexto = (arm = armazenamentoEmMemoria()) => ({ armazenamento: arm, agora: () => AGORA })

// Um registro por naipe e por tipo de mão, com os campos que cada caso exige.
const variados = () => [
  registroDeTeste({ sessionId: 'a', hand: 'AA', cards: [{ rank: 'A', suit: 'h' }, { rank: 'A', suit: 'c' }] }),
  registroDeTeste({ sessionId: 'a', hand: 'KQo', cards: [{ rank: 'K', suit: 'd' }, { rank: 'Q', suit: 's' }], answeredAt: '2026-11-16T10:00:09.000Z' }),
  registroDeTeste({
    sessionId: 'b',
    hand: 'T9s',
    cards: [{ rank: 'T', suit: 'd' }, { rank: '9', suit: 'd' }],
    chosenAction: 'fold',
    correct: false,
    ev: 1.25,
    evLeft: 1.25,
    answeredAt: '2026-11-17T09:00:00.000Z',
  }),
  registroDeTeste({ sessionId: 'b', villainType: 'fish', ev: null, hand: '22', cards: [{ rank: '2', suit: 's' }, { rank: '2', suit: 'h' }], answeredAt: '2026-11-17T09:00:30.000Z' }),
  registroDeTeste({ sessionId: 'b', ev: null, edgeHand: true, answeredAt: '2026-11-17T09:01:00.000Z' }),
]

describe('histórico: exportar, importar e substituir (spec 5, ticket 3)', () => {
  it('o arquivo exportado leva a data do relógio no nome e o envelope no conteúdo', () => {
    const h = acrescentar(contexto(), carregarHistorico(contexto()), registroDeTeste())
    const arquivo = exportarHistorico(contexto(), h)
    expect(arquivo.nomeDoArquivo).toBe('trainer-poker-historico-2026-11-16.json')
    const conteudo = JSON.parse(arquivo.conteudo)
    expect(conteudo).toMatchObject({ app: 'trainer-poker', schemaVersion: 1, exportedAt: AGORA })
    expect(conteudo.respostas).toEqual([registroDeTeste()])
    expect(arquivo.conteudo).toContain('\n') // indentado, para um mentor poder ler a olho
  })

  it('exportar e importar devolve exatamente os mesmos registros (e o resumo)', () => {
    const registros = variados()
    const h = registros.reduce((acc, r) => acrescentar(contexto(), acc, r), carregarHistorico(contexto()))
    const leitura = lerImportacao(exportarHistorico(contexto(), h).conteudo)
    expect(leitura).toEqual({ ok: true, registros, resumo: { respostas: 5, sessoes: 2, ultimaResposta: '2026-11-17T09:01:00.000Z' } })
  })

  it('um histórico vazio exporta e importa sem erro', () => {
    const vazio = carregarHistorico(contexto())
    const leitura = lerImportacao(exportarHistorico(contexto(), vazio).conteudo)
    expect(leitura).toEqual({ ok: true, registros: [], resumo: { respostas: 0, sessoes: 0, ultimaResposta: null } })
  })

  const recusados: [string, string][] = [
    ['JSON quebrado', '{"app": "trainer-poker", '],
    ['outra aplicação', JSON.stringify({ app: 'outro', schemaVersion: 1, respostas: [] })],
    ['um array solto', '[]'],
    ['versão do schema que não é número', JSON.stringify({ app: 'trainer-poker', schemaVersion: 'um', respostas: [] })],
    ['versão antiga sem migração', JSON.stringify({ app: 'trainer-poker', schemaVersion: 0, respostas: [] })],
    ['sem a lista de respostas', JSON.stringify({ app: 'trainer-poker', schemaVersion: 1 })],
  ]
  it.each(recusados)('recusa %s', (_nome, texto) => {
    expect(lerImportacao(texto).ok).toBe(false)
  })

  it('recusa um arquivo de versão mais nova, dizendo qual', () => {
    const leitura = lerImportacao(JSON.stringify({ app: 'trainer-poker', schemaVersion: 7, respostas: [] }))
    expect(leitura).toMatchObject({ ok: false, erro: { tipo: 'versao-mais-nova', versao: 7 } })
  })

  const comRegistroRuim = (ruim: unknown) =>
    JSON.stringify({ app: 'trainer-poker', schemaVersion: 1, respostas: [registroDeTeste(), registroDeTeste(), ruim, registroDeTeste()] })
  const semCampo = (campo: string) => {
    const r: Record<string, unknown> = { ...registroDeTeste() }
    delete r[campo]
    return r
  }
  const registrosRuins: [string, unknown, string][] = [
    ['campo faltando', semCampo('sessionId'), 'sessionId'],
    ['tipo errado na data', { ...registroDeTeste(), answeredAt: 123 }, 'answeredAt'],
    ['data inválida', { ...registroDeTeste(), answeredAt: 'ontem' }, 'answeredAt'],
    ['família inexistente', { ...registroDeTeste(), family: 'squeeze' }, 'family'],
    ['posição inexistente', { ...registroDeTeste(), hero: 'MP' }, 'hero'],
    ['vilão inexistente', { ...registroDeTeste(), villainType: 'maniaco' }, 'villainType'],
    ['ação escolhida inexistente', { ...registroDeTeste(), chosenAction: 'allin' }, 'chosenAction'],
    ['ação certa fora do range', { ...registroDeTeste(), correctAction: 'out_of_range' }, 'correctAction'],
    ['EV em texto', { ...registroDeTeste(), ev: '1.5' }, 'ev'],
    ['mão que não é uma classe', { ...registroDeTeste(), hand: 'A5' }, 'hand'],
    ['cartas que não combinam com a mão', { ...registroDeTeste(), cards: [{ rank: 'K', suit: 's' }, { rank: '5', suit: 's' }] }, 'cards'],
    ['suited com naipes diferentes', { ...registroDeTeste(), cards: [{ rank: 'A', suit: 's' }, { rank: '5', suit: 'h' }] }, 'cards'],
    ['carta com naipe inexistente', { ...registroDeTeste(), cards: [{ rank: 'A', suit: 'x' }, { rank: '5', suit: 'x' }] }, 'cards'],
    ['correto que contradiz as ações', { ...registroDeTeste(), correct: false }, 'correct'],
    ['EV contra fish', { ...registroDeTeste(), villainType: 'fish' }, 'ev'],
    ['EV numa ação certa de fold', { ...registroDeTeste(), correctAction: 'fold', chosenAction: 'fold' }, 'ev'],
    ['EV deixado sem ser fold errado', { ...registroDeTeste(), evLeft: 0.5 }, 'evLeft'],
    ['EV deixado negativo', { ...registroDeTeste(), evLeft: -1 }, 'evLeft'],
    ['mão de borda com EV', { ...registroDeTeste(), edgeHand: true }, 'edgeHand'],
  ]
  it.each(registrosRuins)('recusa o arquivo com um registro com %s, apontando o registro e o campo', (_nome, ruim, campo) => {
    const leitura = lerImportacao(comRegistroRuim(ruim))
    expect(leitura.ok).toBe(false)
    if (leitura.ok) return
    expect(leitura.erro).toMatchObject({ tipo: 'invalido', registro: 3, campo })
    expect(leitura.erro.mensagem).toContain('Registro 3')
  })

  it('recusa um EV que não é finito (1e999 vira Infinity no JSON)', () => {
    const texto = JSON.stringify({ app: 'trainer-poker', schemaVersion: 1, respostas: [registroDeTeste()] }).replace('"ev":0.5', '"ev":1e999')
    expect(lerImportacao(texto)).toMatchObject({ ok: false, erro: { registro: 1, campo: 'ev' } })
  })

  it('marcar o backup guarda a data do relógio e carregar a devolve', () => {
    const arm = armazenamentoEmMemoria()
    const ctx = contexto(arm)
    const h = marcarBackup(ctx, carregarHistorico(ctx))
    expect(h.ultimoBackup).toBe(AGORA)
    expect(carregarHistorico(contexto(arm)).ultimoBackup).toBe(AGORA)
  })

  it('marcar o backup não lança com o armazenamento bloqueado, e a data fica na memória', () => {
    const arm = armazenamentoEmMemoria()
    arm.falhas.aoGravar = true
    const h = marcarBackup(contexto(arm), carregarHistorico(contexto(arm)))
    expect(h.ultimoBackup).toBe(AGORA)
  })

  it('substituir grava o novo histórico e o devolve', () => {
    const arm = armazenamentoEmMemoria()
    const ctx = contexto(arm)
    const antigo = acrescentar(ctx, carregarHistorico(ctx), registroDeTeste({ sessionId: 'velha' }))
    const novos = variados()
    const resultado = substituirHistorico(ctx, antigo, novos)
    expect(resultado.ok).toBe(true)
    expect(resultado.historico.registros).toEqual(novos)
    expect(carregarHistorico(contexto(arm)).registros).toEqual(novos)
  })

  it('substituir por um histórico vazio zera o histórico', () => {
    const arm = armazenamentoEmMemoria()
    const ctx = contexto(arm)
    const antigo = acrescentar(ctx, carregarHistorico(ctx), registroDeTeste())
    const resultado = substituirHistorico(ctx, antigo, [])
    expect(resultado.ok).toBe(true)
    expect(carregarHistorico(contexto(arm)).registros).toEqual([])
  })

  it('se a gravação falha, substituir devolve o histórico antigo e o armazenamento continua com o antigo', () => {
    const arm = armazenamentoEmMemoria()
    const ctx = contexto(arm)
    const antigo = acrescentar(ctx, carregarHistorico(ctx), registroDeTeste({ sessionId: 'velha' }))
    arm.falhas.aoGravar = true
    const resultado = substituirHistorico(ctx, antigo, variados())
    expect(resultado.ok).toBe(false)
    expect(resultado.historico.registros).toEqual(antigo.registros)
    arm.falhas.aoGravar = false
    expect(carregarHistorico(contexto(arm)).registros).toEqual(antigo.registros)
  })

  it('não substitui quando o histórico é só de memória (não grava por cima do dado ilegível)', () => {
    const arm = armazenamentoEmMemoria({ [CHAVE_DO_HISTORICO]: '{ruim' })
    arm.falhas.aoGravar = true
    const h = carregarHistorico(contexto(arm))
    arm.falhas.aoGravar = false
    const resultado = substituirHistorico(contexto(arm), h, variados())
    expect(resultado.ok).toBe(false)
    expect(arm.itens.get(CHAVE_DO_HISTORICO)).toBe('{ruim')
  })

  it('o registro que a sessão produz para cada um dos 127 spots passa na validação da importação', () => {
    expect(dados.spots).toHaveLength(127)
    for (const spot of dados.spots) {
      const mao = primeiraMao(spot.id)
      for (const acao of ['fold', 'call', 'raise', 'jam'] as const) {
        const sessao = sessaoDe(spot.id, mao)
        if (!sessao.pergunta?.options.some((o) => o.action === acao)) continue
        const registro = responder(sessao, acao).respostas[0]!
        const texto = JSON.stringify({ app: 'trainer-poker', schemaVersion: 1, respostas: [registro] })
        const leitura = lerImportacao(texto)
        expect(leitura.ok, `${spot.id} / ${mao} / ${acao}: ${leitura.ok ? '' : leitura.erro.mensagem}`).toBe(true)
      }
    }
  })
})
