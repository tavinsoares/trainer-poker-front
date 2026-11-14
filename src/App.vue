<script setup lang="ts">
// Esqueleto: as telas entram nas specs 3 a 5.
</script>

<template>
  <main class="app">
    <h1 class="app__title">Trainer Poker</h1>
  </main>
</template>

<style>
/* Reset mínimo do body: sem margem padrão, o fundo escuro cobre a página inteira. */
body {
  margin: 0;
  background: #0b0f14;
}
</style>

<style scoped>
.app {
  min-height: 100vh;
  padding: 32px 40px;
  background: #0b0f14;
  color: #e6e9ee;
  font-family: Inter, system-ui, sans-serif;
}

.app__title {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
}
</style>
