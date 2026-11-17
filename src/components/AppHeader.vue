<script setup lang="ts">
// Navegação: só o Drill existe na v1 (spec 4). Estudo, Leaks e Config entram nas specs seguintes
// e aparecem desabilitados, sem roteador.
const itens = [
  { nome: 'Drill', ativo: true },
  { nome: 'Estudo', ativo: false },
  { nome: 'Leaks', ativo: false },
  { nome: 'Config', ativo: false },
]
</script>

<template>
  <header class="app-header">
    <div class="app-header__inner">
      <span class="app-header__brand">Trainer <br />Poker</span>
      <nav class="app-header__nav" aria-label="Telas">
        <template v-for="item in itens" :key="item.nome">
          <span v-if="item.ativo" class="app-header__item app-header__item--active" aria-current="page">{{ item.nome }}</span>
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
