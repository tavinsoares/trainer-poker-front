<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import ErrorBarList from '../components/ErrorBarList.vue'
import FilterChips from '../components/FilterChips.vue'
import LeakTable from '../components/LeakTable.vue'
import StatTile from '../components/StatTile.vue'
import { ranges } from '../data/ranges.ts'
import { bbBr, percentualBr } from '../domain/formato.ts'
import {
  calcularLeaks,
  FILTROS_DOS_LEAKS_PADRAO,
  MINIMO_DE_TENTATIVAS,
  type FiltrosDosLeaks,
  type LinhaDeSpot,
} from '../domain/leaks.ts'
import { useDrillStore } from '../stores/drill.ts'
import { useHistoricoStore } from '../stores/historico.ts'

// A tela de Leaks (spec 5): somente leitura. O cálculo é do domínio; aqui só se escolhem os
// filtros (que não são persistidos) e se desenha o resultado.
const { registros } = storeToRefs(useHistoricoStore())
const drill = useDrillStore()
const router = useRouter()

const filtros = ref<FiltrosDosLeaks>({ ...FILTROS_DOS_LEAKS_PADRAO })
// O "agora" dos períodos fica fixo enquanto a tela está aberta: a tela só muda quando o aluno age.
const agora = new Date().toISOString()
const leaks = computed(() => calcularLeaks(ranges, registros.value, filtros.value, agora))

const VILAO = [
  { valor: 'ambos', rotulo: 'Ambos' },
  { valor: 'regular', rotulo: 'Regular' },
  { valor: 'fish', rotulo: 'Fish' },
]
const PERIODO = [
  { valor: '7d', rotulo: '7 dias' },
  { valor: '30d', rotulo: '30 dias' },
  { valor: 'tudo', rotulo: 'Tudo' },
]

function treinar(linha: LinhaDeSpot) {
  drill.treinar({ vilao: linha.vilao, familia: linha.familia, hero: linha.hero })
  void router.push('/')
}
</script>

<template>
  <main class="leaks-view">
    <header class="leaks-view__head">
      <div>
        <span class="leaks-view__eyebrow">Seus leaks</span>
        <h1 class="leaks-view__title" tabindex="-1" data-page-title>Onde você mais erra</h1>
      </div>
      <div class="leaks-view__filters">
        <FilterChips
          titulo="Vilão"
          :opcoes="VILAO"
          :selecionados="[filtros.vilao]"
          @mudar="filtros = { ...filtros, vilao: $event[0] as FiltrosDosLeaks['vilao'] }"
        />
        <FilterChips
          titulo="Período"
          :opcoes="PERIODO"
          :selecionados="[filtros.periodo]"
          @mudar="filtros = { ...filtros, periodo: $event[0] as FiltrosDosLeaks['periodo'] }"
        />
      </div>
    </header>

    <section v-if="leaks.estado === 'sem-historico'" class="leaks-view__empty" aria-live="polite">
      <h2 class="leaks-view__empty-title">Você ainda não respondeu nenhuma mão</h2>
      <p class="leaks-view__empty-text">Os leaks aparecem aqui assim que você treinar no drill.</p>
      <RouterLink to="/" class="leaks-view__empty-link">Ir para o drill</RouterLink>
    </section>

    <section v-else-if="leaks.estado === 'sem-respostas-nos-filtros'" class="leaks-view__empty" aria-live="polite">
      <h2 class="leaks-view__empty-title">Nenhuma resposta com esses filtros</h2>
      <p class="leaks-view__empty-text">Troque o vilão ou o período para ver as suas respostas.</p>
    </section>

    <template v-else>
      <section class="leaks-view__stats" aria-label="Métricas">
        <StatTile rotulo="Respostas" :valor="String(leaks.metricas.respostas)" />
        <StatTile
          rotulo="Corretas"
          tom="correto"
          :valor="String(leaks.metricas.corretas)"
          :detalhe="leaks.metricas.taxaDeAcerto === null ? undefined : percentualBr(leaks.metricas.taxaDeAcerto)"
        />
        <StatTile
          rotulo="Erros"
          tom="erro"
          :valor="String(leaks.metricas.erros)"
          :detalhe="leaks.metricas.taxaDeErro === null ? undefined : percentualBr(leaks.metricas.taxaDeErro)"
        />
        <StatTile
          rotulo="EV deixado na mesa"
          :valor="bbBr(leaks.metricas.evDeixado)"
          detalhe="Só folds incorretos em spots contra regular"
        />
      </section>

      <div class="leaks-view__body">
        <div class="leaks-view__bars">
          <ErrorBarList titulo="Taxa de erro por vilão" :linhas="leaks.porVilao" />
          <ErrorBarList titulo="Taxa de erro por posição" :linhas="leaks.porPosicao" />
          <ErrorBarList titulo="Taxa de erro por tipo de spot" :linhas="leaks.porFamilia" />
        </div>

        <section class="leaks-view__spots" aria-labelledby="leaks-spots-titulo">
          <h2 id="leaks-spots-titulo" class="leaks-view__spots-title">Spots com mais erros</h2>
          <p class="leaks-view__muted">Mínimo de {{ MINIMO_DE_TENTATIVAS }} tentativas por spot</p>
          <LeakTable v-if="leaks.spots.length > 0" :linhas="leaks.spots" @treinar="treinar" />
          <p v-else class="leaks-view__muted" role="status">
            Nenhum spot com {{ MINIMO_DE_TENTATIVAS }} tentativas e pelo menos um erro ainda.
          </p>
          <p class="leaks-view__muted">
            EV deixado: soma do EV das mãos em que você deu fold e a ação certa era jogar. Só existe em spots contra regular, então a
            coluna fica em branco contra fish.
          </p>
          <p v-if="leaks.registrosForaDaTabela > 0" class="leaks-view__muted">
            {{ leaks.registrosForaDaTabela }} {{ leaks.registrosForaDaTabela === 1 ? 'resposta' : 'respostas' }} de spots que não existem
            mais nos ranges atuais contam nos números ao lado, mas ficam fora desta tabela.
          </p>
        </section>
      </div>
    </template>
  </main>
</template>

<style scoped>
.leaks-view {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 1360px;
  margin: 0 auto;
  padding: 32px 40px;
}

.leaks-view__head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
}

.leaks-view__eyebrow {
  color: var(--text-faint);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.leaks-view__title {
  margin: 8px 0 0;
  font-size: 28px;
  font-weight: 700;
}

.leaks-view__title:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 4px;
}

.leaks-view__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}

.leaks-view__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.leaks-view__body {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  gap: 24px;
  align-items: start;
}

.leaks-view__bars {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.leaks-view__spots {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 20px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
}

.leaks-view__spots-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
}

.leaks-view__muted {
  margin: 0;
  color: var(--text-faint);
  font-size: 13px;
  line-height: 1.5;
}

.leaks-view__empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 32px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
}

.leaks-view__empty-title {
  margin: 0;
  font-size: 20px;
}

.leaks-view__empty-text {
  margin: 0;
  color: var(--text-muted);
}

.leaks-view__empty-link {
  margin-top: 8px;
  padding: 10px 18px;
  border-radius: 12px;
  background: var(--action-call);
  color: var(--bg);
  font-weight: 700;
  text-decoration: none;
}

.leaks-view__empty-link:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 3px;
}

@media (max-width: 900px) {
  .leaks-view {
    padding: 20px 16px;
  }

  .leaks-view__title {
    font-size: 22px;
  }

  .leaks-view__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .leaks-view__body {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
