import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'
import {
  acrescentar,
  carregarHistorico,
  exportarHistorico,
  marcarBackup,
  resumoDoHistorico,
  substituirHistorico,
  type Armazenamento,
  type ArquivoExportado,
  type Contexto,
  type ResultadoDaSubstituicao,
} from '../domain/historico.ts'
import type { RegistroDeResposta } from '../domain/sessao.ts'

// Store fino do histórico (spec 5): guarda o histórico e chama as operações do domínio. Nenhuma
// regra de negócio mora aqui. O `localStorage` é lido a cada chamada, para que um navegador que o
// bloqueia só falhe dentro do domínio (que sabe tratar a falha), e não ao criar o store.

const armazenamento: Armazenamento = {
  getItem: (chave) => window.localStorage.getItem(chave),
  setItem: (chave, valor) => window.localStorage.setItem(chave, valor),
  removeItem: (chave) => window.localStorage.removeItem(chave),
}

const contexto: Contexto = { armazenamento, agora: () => new Date().toISOString() }

export const useHistoricoStore = defineStore('historico', () => {
  // O histórico é um valor imutável: trocá-lo por inteiro basta.
  const historico = shallowRef(carregarHistorico(contexto))

  const registros = computed(() => historico.value.registros)
  const avisos = computed(() => historico.value.avisos)
  const ultimoBackup = computed(() => historico.value.ultimoBackup)
  const resumo = computed(() => resumoDoHistorico(historico.value.registros))

  /** O gancho do drill: grava a resposta registrada. */
  const registrar = (registro: RegistroDeResposta) => {
    historico.value = acrescentar(contexto, historico.value, registro)
  }

  /** Monta o arquivo de backup e registra a data do backup. A tela entrega o arquivo ao navegador. */
  const exportar = (): ArquivoExportado => {
    const arquivo = exportarHistorico(contexto, historico.value)
    historico.value = marcarBackup(contexto, historico.value)
    return arquivo
  }

  /** Troca o histórico inteiro (a importação substitui). */
  const substituir = (novos: readonly RegistroDeResposta[]): ResultadoDaSubstituicao => {
    const resultado = substituirHistorico(contexto, historico.value, novos)
    historico.value = resultado.historico
    return resultado
  }

  return { historico, registros, avisos, ultimoBackup, resumo, registrar, exportar, substituir }
})
