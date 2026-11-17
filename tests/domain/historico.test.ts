import { describe, expect, it } from 'vitest'
import {
  acrescentar,
  carregarHistorico,
  CHAVE_DO_HISTORICO,
  resumoDoHistorico,
  VERSAO_DO_SCHEMA,
} from '../../src/domain/historico.ts'
import { armazenamentoEmMemoria, registroDeTeste } from './auxiliares.ts'

const AGORA = '2026-11-16T12:00:00.000Z'
const contexto = (arm = armazenamentoEmMemoria()) => ({ armazenamento: arm, agora: () => AGORA })

const envelopeEm = (texto: object) => JSON.stringify(texto)
const valido = (n = 1) => ({
  app: 'trainer-poker',
  schemaVersion: VERSAO_DO_SCHEMA,
  respostas: Array.from({ length: n }, () => registroDeTeste()),
})

describe('histórico: falhas de armazenamento e dado ilegível (spec 5, ticket 2)', () => {
  it('se a gravação falha, o registro continua na memória, vem o aviso e nada lança', () => {
    const arm = armazenamentoEmMemoria()
    const ctx = contexto(arm)
    arm.falhas.aoGravar = true
    const h = acrescentar(ctx, carregarHistorico(ctx), registroDeTeste())
    expect(h.registros).toHaveLength(1)
    expect(h.avisos.map((a) => a.tipo)).toEqual(['gravacao-falhou'])
    expect(arm.itens.has(CHAVE_DO_HISTORICO)).toBe(false)
  })

  it('quando a gravação volta a funcionar, o histórico inteiro é gravado e o aviso some', () => {
    const arm = armazenamentoEmMemoria()
    const ctx = contexto(arm)
    arm.falhas.aoGravar = true
    let h = acrescentar(ctx, carregarHistorico(ctx), registroDeTeste({ hand: 'A5s' }))
    arm.falhas.aoGravar = false
    h = acrescentar(ctx, h, registroDeTeste({ answeredAt: '2026-11-16T10:00:09.000Z' }))
    expect(h.avisos).toEqual([])
    expect(JSON.parse(arm.itens.get(CHAVE_DO_HISTORICO)!).respostas).toHaveLength(2)
  })

  it('se o armazenamento lança na leitura, o histórico começa vazio, com aviso, e não grava por cima', () => {
    const arm = armazenamentoEmMemoria({ [CHAVE_DO_HISTORICO]: envelopeEm(valido(3)) })
    const ctx = contexto(arm)
    arm.falhas.aoLer = true
    const carregado = carregarHistorico(ctx)
    expect(carregado.registros).toEqual([])
    expect(carregado.avisos.map((a) => a.tipo)).toEqual(['armazenamento-indisponivel'])

    arm.falhas.aoLer = false
    const depois = acrescentar(ctx, carregado, registroDeTeste())
    expect(depois.registros).toHaveLength(1)
    // O que estava guardado (e não pôde ser lido) segue intacto.
    expect(JSON.parse(arm.itens.get(CHAVE_DO_HISTORICO)!).respostas).toHaveLength(3)
  })

  const ilegiveis: [string, string][] = [
    ['texto que não é JSON', '{isto nao e json'],
    ['envelope de outra aplicação', envelopeEm({ app: 'outro-app', schemaVersion: 1, respostas: [] })],
    ['envelope sem a lista de respostas', envelopeEm({ app: 'trainer-poker', schemaVersion: 1 })],
    ['registro inválido', envelopeEm({ app: 'trainer-poker', schemaVersion: 1, respostas: [{ ...registroDeTeste(), chosenAction: 'xyz' }] })],
  ]

  it.each(ilegiveis)('%s: começa vazio, avisa e guarda uma cópia do texto original', (_nome, texto) => {
    const arm = armazenamentoEmMemoria({ [CHAVE_DO_HISTORICO]: texto })
    const ctx = contexto(arm)
    const h = carregarHistorico(ctx)
    expect(h.registros).toEqual([])
    const aviso = h.avisos[0]
    expect(aviso?.tipo).toBe('ilegivel')
    if (aviso?.tipo !== 'ilegivel') return
    expect(aviso.copia).not.toBeNull()
    expect(arm.itens.get(aviso.copia!)).toBe(texto)
    // Nada foi apagado nem sobrescrito só por carregar.
    expect(arm.itens.get(CHAVE_DO_HISTORICO)).toBe(texto)

    // Só a próxima gravação do aluno troca o dado; a cópia segue guardada.
    const depois = acrescentar(ctx, h, registroDeTeste())
    expect(JSON.parse(arm.itens.get(CHAVE_DO_HISTORICO)!).respostas).toHaveLength(1)
    expect(arm.itens.get(aviso.copia!)).toBe(texto)
    expect(depois.registros).toHaveLength(1)
  })

  it('uma versão mais nova do schema é reconhecida, avisada e guardada à parte', () => {
    const texto = envelopeEm({ app: 'trainer-poker', schemaVersion: VERSAO_DO_SCHEMA + 1, respostas: [], novidade: true })
    const arm = armazenamentoEmMemoria({ [CHAVE_DO_HISTORICO]: texto })
    const h = carregarHistorico(contexto(arm))
    const aviso = h.avisos[0]
    expect(aviso?.tipo).toBe('versao-mais-nova')
    if (aviso?.tipo !== 'versao-mais-nova') return
    expect(aviso.versao).toBe(VERSAO_DO_SCHEMA + 1)
    expect(arm.itens.get(aviso.copia!)).toBe(texto)
    expect(h.registros).toEqual([])
  })

  it('duas recuperações em momentos diferentes não sobrescrevem a cópia anterior', () => {
    const arm = armazenamentoEmMemoria({ [CHAVE_DO_HISTORICO]: '{ruim 1' })
    const primeira = carregarHistorico({ armazenamento: arm, agora: () => '2026-11-16T10:00:00.000Z' }).avisos[0]
    arm.itens.set(CHAVE_DO_HISTORICO, '{ruim 2')
    const segunda = carregarHistorico({ armazenamento: arm, agora: () => '2026-11-17T10:00:00.000Z' }).avisos[0]
    if (primeira?.tipo !== 'ilegivel' || segunda?.tipo !== 'ilegivel') throw new Error('esperava avisos de ilegível')
    expect(arm.itens.get(primeira.copia!)).toBe('{ruim 1')
    expect(arm.itens.get(segunda.copia!)).toBe('{ruim 2')
  })

  it('se nem a cópia pode ser guardada, o app não grava por cima do dado ilegível', () => {
    const arm = armazenamentoEmMemoria({ [CHAVE_DO_HISTORICO]: '{ruim' })
    arm.falhas.aoGravar = true
    const ctx = contexto(arm)
    const h = carregarHistorico(ctx)
    expect(h.avisos[0]).toMatchObject({ tipo: 'ilegivel', copia: null })
    arm.falhas.aoGravar = false
    const depois = acrescentar(ctx, h, registroDeTeste())
    expect(depois.registros).toHaveLength(1) // a resposta fica na memória
    expect(arm.itens.get(CHAVE_DO_HISTORICO)).toBe('{ruim') // e o dado ilegível não é tocado
  })

  it('uma versão antiga do schema é migrada para a atual e carregada; a atual passa direto', () => {
    const antigo = envelopeEm({ app: 'trainer-poker', schemaVersion: 0, registros: [registroDeTeste()] })
    const arm = armazenamentoEmMemoria({ [CHAVE_DO_HISTORICO]: antigo })
    const migracoes = { 0: (b: Record<string, unknown>) => ({ ...b, schemaVersion: 1, respostas: b.registros }) }
    const h = carregarHistorico(contexto(arm), migracoes)
    expect(h.avisos).toEqual([])
    expect(h.registros).toEqual([registroDeTeste()])

    const atual = armazenamentoEmMemoria({ [CHAVE_DO_HISTORICO]: envelopeEm(valido(2)) })
    expect(carregarHistorico(contexto(atual), migracoes).registros).toHaveLength(2)
  })

  it('uma versão antiga sem migração conhecida é ilegível (e guardada à parte)', () => {
    const antigo = envelopeEm({ app: 'trainer-poker', schemaVersion: 0, registros: [] })
    const arm = armazenamentoEmMemoria({ [CHAVE_DO_HISTORICO]: antigo })
    expect(carregarHistorico(contexto(arm)).avisos[0]?.tipo).toBe('ilegivel')
  })
})

describe('histórico: gravar e carregar (spec 5, ticket 1)', () => {
  it('uma chave ausente é um histórico vazio, sem aviso', () => {
    const h = carregarHistorico(contexto())
    expect(h.registros).toEqual([])
    expect(h.avisos).toEqual([])
    expect(h.ultimoBackup).toBeNull()
  })

  it('acrescentar grava o envelope com a versão do schema e carregar devolve os mesmos registros na mesma ordem', () => {
    const arm = armazenamentoEmMemoria()
    const ctx = contexto(arm)
    const a = registroDeTeste({ answeredAt: '2026-11-16T10:00:00.000Z', hand: 'A5s' })
    const b = registroDeTeste({ answeredAt: '2026-11-16T10:00:05.000Z', hand: 'KQo', cards: [{ rank: 'K', suit: 'h' }, { rank: 'Q', suit: 'd' }] })
    let h = carregarHistorico(ctx)
    h = acrescentar(ctx, h, a)
    h = acrescentar(ctx, h, b)
    expect(h.registros).toEqual([a, b])

    const gravado = JSON.parse(arm.itens.get(CHAVE_DO_HISTORICO)!)
    expect(gravado.app).toBe('trainer-poker')
    expect(gravado.schemaVersion).toBe(VERSAO_DO_SCHEMA)
    expect(gravado.respostas).toHaveLength(2)

    // "Recarregar a página": um carregamento novo sobre o mesmo armazenamento.
    const recarregado = carregarHistorico(contexto(arm))
    expect(recarregado.registros).toEqual([a, b])
    expect(recarregado.avisos).toEqual([])
  })

  it('acrescentar não muda o histórico recebido (valor imutável)', () => {
    const ctx = contexto()
    const antes = carregarHistorico(ctx)
    const depois = acrescentar(ctx, antes, registroDeTeste())
    expect(antes.registros).toHaveLength(0)
    expect(depois.registros).toHaveLength(1)
  })

  it('o resumo conta respostas, sessões distintas e a data da última resposta', () => {
    const registros = [
      registroDeTeste({ sessionId: 'a', answeredAt: '2026-11-10T10:00:00.000Z' }),
      registroDeTeste({ sessionId: 'a', answeredAt: '2026-11-10T10:00:09.000Z' }),
      registroDeTeste({ sessionId: 'b', answeredAt: '2026-11-12T08:30:00.000Z' }),
    ]
    expect(resumoDoHistorico(registros)).toEqual({ respostas: 3, sessoes: 2, ultimaResposta: '2026-11-12T08:30:00.000Z' })
  })

  it('o resumo de um histórico vazio não tem última resposta', () => {
    expect(resumoDoHistorico([])).toEqual({ respostas: 0, sessoes: 0, ultimaResposta: null })
  })
})
