<script setup lang="ts">
import { useTemplateRef } from 'vue'
import type { ResumoDoHistorico } from '../domain/historico.ts'
import { dataHoraBr } from '../domain/formato.ts'

// O cartão do histórico na Config: tamanho, último backup, exportar e importar com confirmação.
// O fluxo da importação (ler o arquivo, validar, substituir) é da tela; aqui só se desenha.
defineProps<{
  resumo: ResumoDoHistorico
  ultimoBackup: string | null
  versaoDoSchema: number
  /** O arquivo escolhido, já validado, esperando a confirmação. */
  pendente: { nomeDoArquivo: string; resumo: ResumoDoHistorico } | null
  /** Por que o último arquivo foi recusado (ou por que a importação não foi gravada). */
  erro: string | null
  /** A importação foi concluída. */
  importado: boolean
}>()

const emit = defineEmits<{
  exportar: []
  escolherArquivo: [arquivo: File]
  confirmar: []
  cancelar: []
}>()

const campoDeArquivo = useTemplateRef<HTMLInputElement>('arquivo')

function aoEscolher(evento: Event) {
  const campo = evento.target as HTMLInputElement
  const arquivo = campo.files?.[0]
  if (arquivo) emit('escolherArquivo', arquivo)
  // Limpa o campo para o mesmo arquivo poder ser escolhido de novo depois de um erro.
  campo.value = ''
}
</script>

<template>
  <section class="data-backup" aria-labelledby="data-backup-titulo">
    <h2 id="data-backup-titulo" class="data-backup__title">Histórico</h2>
    <p class="data-backup__intro">
      Guardado só neste navegador. Limpar os dados do site apaga o histórico. Exporte para fazer backup, levar para outra máquina ou enviar a um mentor.
    </p>

    <p class="data-backup__numbers">
      <strong>{{ resumo.respostas }}</strong> {{ resumo.respostas === 1 ? 'resposta' : 'respostas' }} ·
      <strong>{{ resumo.sessoes }}</strong> {{ resumo.sessoes === 1 ? 'sessão' : 'sessões' }}
    </p>
    <p class="data-backup__meta">Último backup: {{ ultimoBackup ? dataHoraBr(ultimoBackup) : 'nunca' }}</p>

    <div class="data-backup__actions">
      <button type="button" class="data-backup__button" @click="emit('exportar')">Exportar JSON</button>
      <button type="button" class="data-backup__button" @click="campoDeArquivo?.click()">Importar JSON</button>
      <input ref="arquivo" class="data-backup__file" type="file" accept="application/json,.json" tabindex="-1" aria-label="Arquivo de histórico para importar" @change="aoEscolher" />
    </div>

    <p class="data-backup__meta">Schema do histórico: versão {{ versaoDoSchema }}. Importar substitui o histórico atual.</p>

    <div v-if="pendente" class="data-backup__confirm" role="group" aria-label="Confirmar a importação">
      <p class="data-backup__confirm-text">
        <strong>{{ pendente.nomeDoArquivo }}</strong> tem {{ pendente.resumo.respostas }}
        {{ pendente.resumo.respostas === 1 ? 'resposta' : 'respostas' }} em {{ pendente.resumo.sessoes }}
        {{ pendente.resumo.sessoes === 1 ? 'sessão' : 'sessões' }}. Importar vai substituir as {{ resumo.respostas }}
        {{ resumo.respostas === 1 ? 'resposta' : 'respostas' }} que você tem agora.
      </p>
      <div class="data-backup__actions">
        <button type="button" class="data-backup__button data-backup__button--danger" @click="emit('confirmar')">Substituir o histórico</button>
        <button type="button" class="data-backup__button" @click="emit('cancelar')">Cancelar</button>
      </div>
    </div>

    <p v-if="erro" class="data-backup__error" role="alert">{{ erro }}</p>
    <p v-if="importado" class="data-backup__done" role="status">Histórico importado.</p>
  </section>
</template>

<style scoped>
.data-backup {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
}

.data-backup__title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.data-backup__intro,
.data-backup__meta {
  margin: 0;
  color: var(--text-faint);
  font-size: 13px;
  line-height: 1.5;
}

.data-backup__numbers {
  margin: 0;
  color: var(--text-muted);
  font-size: 15px;
}

.data-backup__numbers strong {
  color: var(--text);
  font-size: 20px;
}

.data-backup__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.data-backup__button {
  padding: 10px 18px;
  border: 1px solid var(--border-strong-2);
  border-radius: 12px;
  background: transparent;
  color: var(--text);
  font-family: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.data-backup__button:hover {
  background: var(--surface-2);
}

.data-backup__button:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 2px;
}

.data-backup__button--danger {
  border-color: var(--result-error);
  color: var(--result-error);
}

.data-backup__file {
  display: none;
}

.data-backup__confirm {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--notice-border);
  border-radius: 12px;
  background: var(--notice-bg);
}

.data-backup__confirm-text {
  margin: 0;
  color: var(--text);
  font-size: 14px;
  line-height: 1.5;
}

.data-backup__error {
  margin: 0;
  padding: 12px 16px;
  border: 1px solid var(--result-error);
  border-radius: 12px;
  background: var(--result-error-bg);
  color: var(--result-error);
  font-size: 14px;
}

.data-backup__done {
  margin: 0;
  color: var(--result-correct);
  font-size: 14px;
}
</style>
