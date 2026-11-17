<script setup lang="ts">
// Grupo de chips de filtro. Em modo múltiplo, nenhum marcado vale "todos"; no exclusivo, um só.
const { titulo, opcoes, selecionados, multiplo = false } = defineProps<{
  titulo: string
  opcoes: { valor: string; rotulo: string }[]
  selecionados: string[]
  multiplo?: boolean
}>()

const emit = defineEmits<{
  mudar: [selecionados: string[]]
}>()

function alternar(valor: string) {
  if (!multiplo) return emit('mudar', [valor])
  emit('mudar', selecionados.includes(valor) ? selecionados.filter((v) => v !== valor) : [...selecionados, valor])
}
</script>

<template>
  <div class="filter-chips" role="group" :aria-label="titulo">
    <span class="filter-chips__title">{{ titulo }}</span>
    <div class="filter-chips__list">
      <button
        v-for="opcao in opcoes"
        :key="opcao.valor"
        type="button"
        class="filter-chips__chip"
        :class="{ 'filter-chips__chip--selected': selecionados.includes(opcao.valor) }"
        :aria-pressed="selecionados.includes(opcao.valor)"
        @click="alternar(opcao.valor)"
      >
        {{ opcao.rotulo }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.filter-chips {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.filter-chips__title {
  color: var(--text-faint);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.filter-chips__list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-chips__chip {
  padding: 6px 14px;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  background: transparent;
  color: var(--text-muted);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
}

.filter-chips__chip--selected {
  border-color: var(--action-call);
  background: var(--selected-bg);
  color: var(--text);
}

.filter-chips__chip:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 2px;
}
</style>
