<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { nextTick, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from './components/AppHeader.vue'
import HistoryNotices from './components/HistoryNotices.vue'
import { useHistoricoStore } from './stores/historico.ts'

const { avisos } = storeToRefs(useHistoricoStore())

// Ao trocar de tela, o foco vai ao título da página (as telas que o têm o marcam com
// `data-page-title`). O drill não tem esse título: o foco dele é do próprio fluxo.
const route = useRoute()
watch(
  () => route.path,
  async () => {
    await nextTick()
    document.querySelector<HTMLElement>('[data-page-title]')?.focus()
  },
)
</script>

<template>
  <AppHeader />
  <HistoryNotices :avisos="avisos" />
  <RouterView />
</template>
