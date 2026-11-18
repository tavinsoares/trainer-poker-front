<script setup lang="ts">
import type { Position, SpotFamily, VillainType } from '../data/ranges-types.ts'
import type { Filtros } from '../domain/tipos.ts'
import { ROTULO_DA_FAMILIA, type VisaoDaPergunta } from '../domain/visao.ts'
import FilterChips from './FilterChips.vue'
import PokerTable from './PokerTable.vue'
import SessionSummary from './SessionSummary.vue'

// A barra lateral do drill: a sessão, os filtros e o lembrete dos atalhos. Na tela de resposta o
// cartão dos filtros dá lugar ao snapshot da mesa da pergunta (`mesa`), congelado como estava.
defineProps<{
  corretas: number
  erros: number
  sequencia: number
  filtros: Filtros
  /** Com a sessão encerrada, só o resumo da coluna principal importa: o cartão some. */
  encerrada: boolean
  /** A pergunta respondida: com ela, o cartão mostra a mesa dela no lugar dos filtros. */
  mesa?: VisaoDaPergunta | null
}>()

const emit = defineEmits<{
  encerrar: []
  mudarFiltros: [mudanca: Partial<Filtros>]
}>()

const VILAO = [
  { valor: 'regular', rotulo: 'Regular' },
  { valor: 'fish', rotulo: 'Fish' },
  { valor: 'ambos', rotulo: 'Ambos' },
]
const FAMILIAS = (Object.keys(ROTULO_DA_FAMILIA) as SpotFamily[]).map((valor) => ({ valor, rotulo: ROTULO_DA_FAMILIA[valor] }))
const POSICOES = (['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const).map((valor) => ({ valor, rotulo: valor }))
</script>

<template>
  <aside class="drill-sidebar" aria-label="Sessão e filtros">
    <SessionSummary v-if="!encerrada" :corretas="corretas" :erros="erros" :sequencia="sequencia" @encerrar="emit('encerrar')" />

    <section v-if="mesa" class="drill-sidebar__card" aria-label="Mesa da pergunta">
      <h2 class="drill-sidebar__title">Mesa</h2>
      <PokerTable :assentos="mesa.assentos" :pote="mesa.pote" :mao="mesa.mao" />
    </section>

    <section v-else class="drill-sidebar__card" aria-label="Filtros">
      <h2 class="drill-sidebar__title">Filtros</h2>
      <FilterChips
        titulo="Vilão"
        :opcoes="VILAO"
        :selecionados="[filtros.vilao]"
        @mudar="emit('mudarFiltros', { vilao: $event[0] as VillainType | 'ambos' })"
      />
      <FilterChips
        titulo="Tipo de spot"
        multiplo
        :opcoes="FAMILIAS"
        :selecionados="filtros.familias"
        @mudar="emit('mudarFiltros', { familias: $event as SpotFamily[] })"
      />
      <FilterChips
        titulo="Sua posição"
        multiplo
        :opcoes="POSICOES"
        :selecionados="filtros.posicoes"
        @mudar="emit('mudarFiltros', { posicoes: $event as Position[] })"
      />
    </section>

    <p class="drill-sidebar__shortcuts">
      Atalhos: <kbd>F</kbd> fold · <kbd>C</kbd> call · <kbd>R</kbd> raise · <kbd>J</kbd> jam · <kbd>Enter</kbd> próximo spot
    </p>
  </aside>
</template>

<style scoped>
.drill-sidebar {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.drill-sidebar__card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
}

.drill-sidebar__title {
  margin: 0;
  color: var(--text-faint);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.drill-sidebar__shortcuts {
  margin: 0;
  color: var(--text-faint);
  font-size: 12px;
  line-height: 1.8;
}

.drill-sidebar__shortcuts kbd {
  padding: 1px 6px;
  border: 1px solid var(--border-strong-2);
  border-radius: 6px;
  color: var(--text-muted);
  font-family: ui-monospace, monospace;
}
</style>
