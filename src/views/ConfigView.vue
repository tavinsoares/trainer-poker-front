<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import DataBackup from '../components/DataBackup.vue'
import SourceNotice from '../components/SourceNotice.vue'
import { ranges } from '../data/ranges.ts'
import { origemDosRanges } from '../domain/formato.ts'
import { lerImportacao, VERSAO_DO_SCHEMA, type ResumoDoHistorico } from '../domain/historico.ts'
import type { RegistroDeResposta } from '../domain/sessao.ts'
import { useHistoricoStore } from '../stores/historico.ts'

// A tela de Config (spec 5): atalhos, pontuação, histórico (exportar e importar) e origem dos
// ranges. O fluxo da importação passa pelo domínio (validar e substituir); aqui só se encadeia.
const store = useHistoricoStore()
const { resumo, ultimoBackup } = storeToRefs(store)
const origem = computed(() => origemDosRanges(ranges))

const pendente = ref<{ nomeDoArquivo: string; resumo: ResumoDoHistorico; registros: RegistroDeResposta[] } | null>(null)
const erro = ref<string | null>(null)
const importado = ref(false)

/** Entrega o arquivo ao navegador como download. */
function baixar(nomeDoArquivo: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = nomeDoArquivo
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function exportar() {
  const arquivo = store.exportar()
  baixar(arquivo.nomeDoArquivo, arquivo.conteudo)
}

async function escolherArquivo(arquivo: File) {
  importado.value = false
  pendente.value = null
  erro.value = null
  const leitura = lerImportacao(await arquivo.text())
  if (!leitura.ok) {
    erro.value = `O arquivo "${arquivo.name}" foi recusado e o histórico atual não mudou. ${leitura.erro.mensagem}`
    return
  }
  pendente.value = { nomeDoArquivo: arquivo.name, resumo: leitura.resumo, registros: leitura.registros }
}

function confirmar() {
  if (!pendente.value) return
  const resultado = store.substituir(pendente.value.registros)
  pendente.value = null
  if (resultado.ok) importado.value = true
  else erro.value = resultado.mensagem
}

function cancelar() {
  pendente.value = null
}

const ATALHOS = [
  { tecla: 'F', texto: 'Fold' },
  { tecla: 'C', texto: 'Call' },
  { tecla: 'R', texto: 'Raise (Open, 3bet ou 4bet)' },
  { tecla: 'J', texto: 'Jam' },
  { tecla: 'Enter', texto: 'Próximo spot' },
]
</script>

<template>
  <main class="config-view">
    <header class="config-view__head">
      <span class="config-view__eyebrow">Configurações</span>
      <h1 class="config-view__title" tabindex="-1" data-page-title>Atalhos, histórico e origem dos ranges</h1>
    </header>

    <div class="config-view__grid">
      <section class="config-view__card" aria-labelledby="config-atalhos">
        <h2 id="config-atalhos" class="config-view__card-title">Atalhos de teclado</h2>
        <p class="config-view__muted">Para responder sem tirar a mão do teclado.</p>
        <ul class="config-view__keys">
          <li v-for="atalho in ATALHOS" :key="atalho.tecla" class="config-view__key-row">
            <kbd class="config-view__kbd">{{ atalho.tecla }}</kbd> {{ atalho.texto }}
          </li>
        </ul>
      </section>

      <section class="config-view__card" aria-labelledby="config-pontuacao">
        <h2 id="config-pontuacao" class="config-view__card-title">Como a resposta é pontuada</h2>
        <p class="config-view__text">
          Cada mão tem uma ação certa em cada spot. A resposta é <strong>correta</strong> ou <strong>erro</strong>, sem meio-termo.
          Quando o spot é contra regular e você dá fold numa mão com EV, o app mostra quantos bb você deixou na mesa. O EV só existe
          contra regular: a planilha não o traz contra fish.
        </p>
      </section>

      <DataBackup
        class="config-view__wide"
        :resumo="resumo"
        :ultimo-backup="ultimoBackup"
        :versao-do-schema="VERSAO_DO_SCHEMA"
        :pendente="pendente"
        :erro="erro"
        :importado="importado"
        @exportar="exportar"
        @escolher-arquivo="escolherArquivo"
        @confirmar="confirmar"
        @cancelar="cancelar"
      />

      <SourceNotice class="config-view__wide" :origem="origem" />
    </div>
  </main>
</template>

<style scoped>
.config-view {
  max-width: 1360px;
  margin: 0 auto;
  padding: 32px 40px;
}

.config-view__head {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
}

.config-view__eyebrow {
  color: var(--text-faint);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.config-view__title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
}

.config-view__title:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 4px;
}

.config-view__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}

.config-view__wide {
  grid-column: span 2;
}

.config-view__card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
}

.config-view__card-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.config-view__muted {
  margin: 0;
  color: var(--text-faint);
  font-size: 13px;
}

.config-view__text {
  margin: 0;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1.6;
}

.config-view__keys {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.config-view__key-row {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--text-muted);
  font-size: 14px;
}

.config-view__kbd {
  min-width: 52px;
  padding: 3px 10px;
  border: 1px solid var(--border-strong-2);
  border-radius: 8px;
  color: var(--text);
  font-family: ui-monospace, monospace;
  font-size: 12px;
  text-align: center;
}

@media (max-width: 900px) {
  .config-view {
    padding: 20px 16px;
  }

  .config-view__grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .config-view__wide {
    grid-column: auto;
  }

  .config-view__title {
    font-size: 22px;
  }
}
</style>
