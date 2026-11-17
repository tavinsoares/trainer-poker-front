import {
  APP,
  lerHistorico,
  MIGRACOES,
  VERSAO_DO_SCHEMA,
  type Envelope,
  type ErroDeLeitura,
  type Migracoes,
} from './historico-formato.ts'
import type { RegistroDeResposta } from './sessao.ts'

// O histórico (spec 5): grava cada resposta, carrega ao iniciar, exporta e importa. Puro
// TypeScript e imutável: cada operação recebe o histórico e devolve o novo. Sem Vue, sem Pinia, e
// sem tocar em `localStorage` ou `Date`: o armazenamento e o relógio entram pelo contexto. Nenhuma
// operação lança por falha de armazenamento: a falha vira um aviso, e o treino segue na memória.

export { APP, VERSAO_DO_SCHEMA }
export type { Envelope }

export const CHAVE_DO_HISTORICO = 'trainer-poker:historico'
export const CHAVE_DO_BACKUP = 'trainer-poker:ultimo-backup'

/** A interface mínima de `Storage` de que o histórico precisa. */
export interface Armazenamento {
  getItem(chave: string): string | null
  setItem(chave: string, valor: string): void
  removeItem(chave: string): void
}

/** O que o histórico precisa de fora. */
export interface Contexto {
  armazenamento: Armazenamento
  /** Data e hora atuais em ISO 8601. */
  agora: () => string
}

/** O que a tela mostra numa faixa de aviso. */
export type Aviso =
  | { tipo: 'gravacao-falhou'; mensagem: string }
  | { tipo: 'armazenamento-indisponivel'; mensagem: string }
  /** `copia` é a chave em que o texto original ficou guardado, ou `null` se nem isso foi possível. */
  | { tipo: 'ilegivel'; mensagem: string; copia: string | null }
  | { tipo: 'versao-mais-nova'; mensagem: string; versao: number; copia: string | null }

export interface Historico {
  readonly registros: readonly RegistroDeResposta[]
  /** Data e hora do último backup (ISO 8601), ou `null` se nunca exportou. */
  readonly ultimoBackup: string | null
  readonly avisos: readonly Aviso[]
  /**
   * Não grava: há um dado guardado que não pôde ser lido nem copiado, e gravar por cima o
   * apagaria. O treino e o histórico da aba seguem na memória.
   */
  readonly somenteMemoria: boolean
}

export interface ResumoDoHistorico {
  respostas: number
  /** Ids de sessão distintos. */
  sessoes: number
  /** Data e hora da última resposta, ou `null` sem respostas. */
  ultimaResposta: string | null
}

export function resumoDoHistorico(registros: readonly RegistroDeResposta[]): ResumoDoHistorico {
  let ultima: string | null = null
  for (const r of registros) {
    if (ultima === null || Date.parse(r.answeredAt) > Date.parse(ultima)) ultima = r.answeredAt
  }
  return {
    respostas: registros.length,
    sessoes: new Set(registros.map((r) => r.sessionId)).size,
    ultimaResposta: ultima,
  }
}

const AVISO_GRAVACAO: Aviso = {
  tipo: 'gravacao-falhou',
  mensagem:
    'Não foi possível gravar o histórico neste navegador (armazenamento bloqueado ou cheio). As respostas novas valem só até fechar a aba. Exporte o histórico em Config para não perdê-las.',
}

function envelopeDe(registros: readonly RegistroDeResposta[]): Envelope {
  return { app: APP, schemaVersion: VERSAO_DO_SCHEMA, respostas: [...registros] }
}

/** Lê a data do último backup sem deixar uma falha do navegador subir. */
function lerUltimoBackup(armazenamento: Armazenamento): string | null {
  try {
    return armazenamento.getItem(CHAVE_DO_BACKUP)
  } catch {
    return null
  }
}

/** Guarda o texto ilegível numa chave própria (uma por momento, para não sobrescrever cópias antigas). */
function guardarCopia(contexto: Contexto, texto: string): string | null {
  const chave = `${CHAVE_DO_HISTORICO}:ilegivel:${contexto.agora()}`
  try {
    contexto.armazenamento.setItem(chave, texto)
    return chave
  } catch {
    return null
  }
}

const sobreACopia = (copia: string | null): string =>
  copia
    ? 'Uma cópia do dado ficou guardada neste navegador.'
    : 'Não foi possível guardar uma cópia, então as respostas desta aba não serão gravadas, para não apagar o dado.'

/** Lê o histórico guardado. Nunca lança e nunca apaga um dado que não conseguiu ler. */
export function carregarHistorico(contexto: Contexto, migracoes: Migracoes = MIGRACOES): Historico {
  const vazio: Historico = { registros: [], ultimoBackup: null, avisos: [], somenteMemoria: false }
  let texto: string | null
  try {
    texto = contexto.armazenamento.getItem(CHAVE_DO_HISTORICO)
  } catch {
    return {
      ...vazio,
      somenteMemoria: true,
      avisos: [
        {
          tipo: 'armazenamento-indisponivel',
          mensagem:
            'Não foi possível ler o histórico guardado neste navegador. O treino continua, mas as respostas desta aba não serão gravadas, para não apagar o que está guardado.',
        },
      ],
    }
  }
  const ultimoBackup = lerUltimoBackup(contexto.armazenamento)
  if (texto === null) return { ...vazio, ultimoBackup }

  const leitura = lerHistorico(texto, migracoes)
  if (leitura.ok) return { ...vazio, ultimoBackup, registros: leitura.registros }

  const copia = guardarCopia(contexto, texto)
  const { erro } = leitura
  const aviso: Aviso =
    erro.tipo === 'versao-mais-nova'
      ? { tipo: 'versao-mais-nova', versao: erro.versao, copia, mensagem: `${erro.mensagem} A sessão começa com o histórico vazio. ${sobreACopia(copia)}` }
      : { tipo: 'ilegivel', copia, mensagem: `O histórico guardado não pôde ser lido: ${erro.mensagem} A sessão começa com o histórico vazio. ${sobreACopia(copia)}` }
  return { ...vazio, ultimoBackup, avisos: [aviso], somenteMemoria: copia === null }
}

/** O arquivo de backup: o nome com a data do relógio e o envelope indentado, que um mentor lê a olho. */
export interface ArquivoExportado {
  nomeDoArquivo: string
  conteudo: string
}

export function exportarHistorico(contexto: Contexto, historico: Historico): ArquivoExportado {
  const exportadoEm = contexto.agora()
  const envelope: Envelope = { ...envelopeDe(historico.registros), exportedAt: exportadoEm }
  return {
    nomeDoArquivo: `trainer-poker-historico-${exportadoEm.slice(0, 10)}.json`,
    conteudo: JSON.stringify(envelope, null, 2),
  }
}

/** Registra que o aluno acabou de exportar. Se não der para guardar a data, ela fica na memória. */
export function marcarBackup(contexto: Contexto, historico: Historico): Historico {
  const agora = contexto.agora()
  try {
    contexto.armazenamento.setItem(CHAVE_DO_BACKUP, agora)
  } catch {
    // Só a data do backup se perde ao recarregar; o histórico não é afetado.
  }
  return { ...historico, ultimoBackup: agora }
}

export type ResultadoDaImportacao =
  | { ok: true; registros: RegistroDeResposta[]; resumo: ResumoDoHistorico }
  | { ok: false; erro: ErroDeLeitura }

/** Lê e valida o texto de um arquivo importado: aceita tudo ou nada. */
export function lerImportacao(texto: string): ResultadoDaImportacao {
  const leitura = lerHistorico(texto)
  if (!leitura.ok) return leitura
  return { ok: true, registros: leitura.registros, resumo: resumoDoHistorico(leitura.registros) }
}

export type ResultadoDaSubstituicao =
  | { ok: true; historico: Historico }
  | { ok: false; historico: Historico; mensagem: string }

/**
 * Troca o histórico inteiro (a importação substitui). Só devolve o novo se conseguiu gravar; se
 * não, devolve o antigo, para a memória e o armazenamento não divergirem.
 */
export function substituirHistorico(
  contexto: Contexto,
  historico: Historico,
  registros: readonly RegistroDeResposta[],
): ResultadoDaSubstituicao {
  if (historico.somenteMemoria) {
    return {
      ok: false,
      historico,
      mensagem: 'Não foi possível importar: há um histórico guardado que não pôde ser lido nem copiado, e gravar por cima o apagaria.',
    }
  }
  try {
    contexto.armazenamento.setItem(CHAVE_DO_HISTORICO, JSON.stringify(envelopeDe(registros)))
  } catch {
    return {
      ok: false,
      historico,
      mensagem: 'Não foi possível gravar o histórico importado neste navegador (armazenamento bloqueado ou cheio). O histórico atual foi mantido.',
    }
  }
  return { ok: true, historico: { ...historico, registros: [...registros], avisos: semAvisoDeGravacao(historico.avisos) } }
}

const semAvisoDeGravacao =(avisos: readonly Aviso[]): Aviso[] => avisos.filter((a) => a.tipo !== 'gravacao-falhou')

/** Acrescenta uma resposta e grava o envelope inteiro. Se não gravar, o registro fica na memória. */
export function acrescentar(contexto: Contexto, historico: Historico, registro: RegistroDeResposta): Historico {
  const registros = [...historico.registros, registro]
  if (historico.somenteMemoria) return { ...historico, registros }
  try {
    contexto.armazenamento.setItem(CHAVE_DO_HISTORICO, JSON.stringify(envelopeDe(registros)))
    return { ...historico, registros, avisos: semAvisoDeGravacao(historico.avisos) }
  } catch {
    return { ...historico, registros, avisos: [...semAvisoDeGravacao(historico.avisos), AVISO_GRAVACAO] }
  }
}
