<script setup lang="ts">
// Navegação (spec 5): Drill, Leaks e Config são telas de verdade; Estudo ainda não existe e
// aparece desabilitado, sem link. O roteador marca a tela atual com `aria-current`.
const itens = [
  { nome: 'Drill', para: '/' },
  { nome: 'Estudo', para: null },
  { nome: 'Leaks', para: '/leaks' },
  { nome: 'Config', para: '/config' },
]
</script>

<template>
  <header class="app-header">
    <div class="app-header__inner">
      <span class="app-header__brand">Trainer <br />Poker</span>
      <nav class="app-header__nav" aria-label="Telas">
        <template v-for="item in itens" :key="item.nome">
          <RouterLink v-if="item.para" :to="item.para" class="app-header__item" exact-active-class="app-header__item--active">
            {{ item.nome }}
          </RouterLink>
          <span v-else class="app-header__item app-header__item--disabled" aria-disabled="true" title="Em breve">{{ item.nome }}</span>
        </template>
      </nav>
      <span class="app-header__context">6-max · 100bb · cash</span>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  background: var(--bg-header);
  border-bottom: 1px solid var(--border);
}

.app-header__inner {
  display: flex;
  align-items: center;
  gap: 32px;
  max-width: 1360px;
  min-height: 64px;
  margin: 0 auto;
  padding: 8px 40px;
}

.app-header__brand {
  font-size: 15px;
  font-weight: 700;
  line-height: 1.1;
}

.app-header__nav {
  display: flex;
  gap: 4px;
}

.app-header__item {
  padding: 8px 14px;
  border-radius: 10px;
  color: var(--text-muted);
  font-size: 14px;
  font-weight: 500;
}

a.app-header__item {
  text-decoration: none;
}

a.app-header__item:hover {
  color: var(--text);
}

a.app-header__item:focus-visible {
  outline: 2px solid #ffffff;
  outline-offset: 2px;
}

.app-header__item--active {
  background: var(--surface-2);
  color: var(--text);
}

.app-header__item--disabled {
  color: var(--text-faint);
  opacity: 0.6;
  cursor: not-allowed;
}

.app-header__context {
  margin-left: auto;
  color: var(--text-faint);
  font-size: 13px;
}

@media (max-width: 900px) {
  .app-header__inner {
    flex-wrap: wrap;
    gap: 12px 20px;
    padding: 8px 16px;
  }

  .app-header__context {
    display: none;
  }
}
</style>
