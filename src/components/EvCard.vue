<script setup lang="ts">
import type { BlocoDeEv } from '../domain/visao.ts'

// O bloco de EV do feedback. Contra fish só a mensagem; contra regular, as linhas de EV, o que o
// aluno deixou na mesa, o aviso de mão de borda e a nota de procedência do número.
defineProps<{
  bloco: BlocoDeEv
}>()
</script>

<template>
  <section class="ev-card" aria-label="EV">
    <h3 class="ev-card__title">EV (em bb)</h3>
    <p v-if="bloco.tipo === 'fish'" class="ev-card__message">{{ bloco.mensagem }}</p>
    <template v-else>
      <dl class="ev-card__rows">
        <div v-for="linha in bloco.linhas" :key="linha.rotulo" class="ev-card__row">
          <dt>{{ linha.rotulo }}</dt>
          <dd>{{ linha.valor }}</dd>
        </div>
      </dl>
      <p v-if="bloco.deixou" class="ev-card__left">{{ bloco.deixou }}</p>
      <p v-if="bloco.aviso" class="ev-card__notice">{{ bloco.aviso }}</p>
      <p class="ev-card__note">{{ bloco.nota }}</p>
    </template>
  </section>
</template>

<style scoped>
.ev-card {
  padding: 16px 20px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--surface);
}

.ev-card__title {
  margin: 0 0 12px;
  color: var(--text-faint);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.ev-card__rows {
  margin: 0;
}

.ev-card__row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  font-size: 15px;
}

.ev-card__row dt {
  color: var(--text-muted);
}

.ev-card__row dd {
  margin: 0;
  font-weight: 700;
}

.ev-card__left {
  margin: 12px 0 0;
  color: var(--result-error);
  font-weight: 600;
}

.ev-card__notice {
  margin: 12px 0 0;
  padding: 8px 12px;
  border: 1px solid var(--notice-border);
  border-radius: 10px;
  background: var(--notice-bg);
  color: var(--villain-fish);
  font-size: 13px;
}

.ev-card__message,
.ev-card__note {
  margin: 12px 0 0;
  color: var(--text-faint);
  font-size: 13px;
}

.ev-card__message {
  margin-top: 0;
  color: var(--text-muted);
  font-size: 14px;
}
</style>
