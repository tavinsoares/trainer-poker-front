<script setup lang="ts">
import type { VisaoAssento, VisaoDaPergunta } from "../domain/visao.ts";
import BetChip from "./BetChip.vue";
import HandCards from "./HandCards.vue";
import SeatCard from "./SeatCard.vue";

// A mesa oval. O Hero fica sempre embaixo, no centro (slot 0), e os outros seguem em sentido
// horário a partir dele; o slot vem da visão. Aqui só se desenha: cada slot tem a posição do
// assento, da ficha e do botão do dealer (que fica sempre no BTN). A mão do Hero sai pelo topo
// do assento dele, então acompanha o assento e nunca fica por baixo dele.
defineProps<{
  assentos: VisaoAssento[];
  /** O valor do pote no centro ("4bb"). */
  pote: string;
  /** As cartas do Hero, na frente do assento dele. */
  mao: VisaoDaPergunta["mao"];
}>();
</script>

<template>
  <div class="poker-table" role="group" aria-label="Mesa">
    <div class="poker-table__rail" aria-hidden="true"></div>
    <div class="poker-table__felt" aria-hidden="true"></div>
    <div class="poker-table__pot">
      <span class="poker-table__pot-label">POTE</span>
      <strong class="poker-table__pot-value">{{ pote }}</strong>
    </div>
    <div
      v-for="assento in assentos"
      :key="assento.position"
      class="poker-table__slot"
      :class="`poker-table__slot--${assento.slot}`"
    >
      <SeatCard
        :assento="assento"
        class="poker-table__seat"
        :class="{ 'poker-table__seat--hero': assento.estado === 'hero' }"
      >
        <HandCards
          v-if="assento.estado === 'hero'"
          :cartas="mao.cartas"
          leque
        />
      </SeatCard>
      <BetChip
        v-if="assento.ficha"
        :ficha="assento.ficha"
        class="poker-table__chip"
      />
      <span
        v-if="assento.dealer"
        class="poker-table__dealer"
        role="img"
        aria-label="Botão do dealer"
        >D</span
      >
    </div>
  </div>
</template>

<style scoped>
/* O palco tem proporção 38:27 (até 760×540) e as medidas em cqw são relativas à largura dele,
   então a mesa encolhe inteira. Os assentos ficam numa elipse em volta do feltro. */
.poker-table {
  position: relative;
  width: 100%;
  max-width: 760px;
  aspect-ratio: 38 / 27;
  align-self: center;
  container-type: inline-size;
}

.poker-table__rail,
.poker-table__felt {
  position: absolute;
  top: 50%;
  left: 50%;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.poker-table__rail {
  width: 77.6%;
  height: 70.4%;
  border: 1px solid var(--border-strong);
  background: linear-gradient(145deg, #1d2733, #0f161e);
}

.poker-table__felt {
  width: 71.1%;
  height: 63%;
  border: 1px solid #2a4650;
  background: radial-gradient(ellipse at 50% 40%, #1a444b 0%, #10262c 100%);
}

.poker-table__pot {
  position: absolute;
  top: 50%;
  left: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: translate(-50%, -50%);
}

.poker-table__pot-label {
  color: #8fb3ba;
  font-size: 12px;
  letter-spacing: 0.06em;
}

.poker-table__pot-value {
  font-size: clamp(18px, 2.9cqw, 22px);
}

/* Cada slot é uma camada do tamanho do palco; assento, ficha e botão se posicionam nela. */
.poker-table__slot {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.poker-table__seat,
.poker-table__chip,
.poker-table__dealer {
  position: absolute;
  transform: translate(-50%, -50%);
}

.poker-table__seat {
  top: var(--seat-y);
  left: var(--seat-x);
  box-sizing: border-box;
  width: 15.8cqw;
}

.poker-table__seat--hero {
  --card-w: clamp(40px, 7.4cqw, 56px);
  width: 18.4cqw;
}

.poker-table__chip {
  top: var(--chip-y);
  left: var(--chip-x);
}

.poker-table__dealer {
  top: var(--dealer-y);
  left: var(--dealer-x);
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 3.7cqw;
  min-width: 24px;
  aspect-ratio: 1 / 1;
  border-radius: 50%;
  background: var(--card-face);
  box-shadow:
    0 2px 6px rgba(0, 0, 0, 0.5),
    inset 0 0 0 2px #c9c3b4;
  color: #0b0f14;
  font-size: clamp(11px, 1.7cqw, 13px);
  font-weight: 800;
}

/* Slot 0 é o Hero (embaixo); 1 a 5 seguem em sentido horário: embaixo à esquerda, em cima à
   esquerda, no alto, em cima à direita e embaixo à direita. */
.poker-table__slot--0 {
  --seat-x: 50%;
  --seat-y: 95.8%;
  --chip-x: 50%;
  --chip-y: 65.9%;
  --dealer-x: 39.5%;
  --dealer-y: 78.7%;
}

.poker-table__slot--1 {
  --seat-x: 15.8%;
  --seat-y: 69.9%;
  --chip-x: 36.3%;
  --chip-y: 58%;
  --dealer-x: 32.7%;
  --dealer-y: 67.4%;
}

.poker-table__slot--2 {
  --seat-x: 15.8%;
  --seat-y: 30.1%;
  --chip-x: 36.3%;
  --chip-y: 42%;
  --dealer-x: 26.4%;
  --dealer-y: 43.6%;
}

.poker-table__slot--3 {
  --seat-x: 50%;
  --seat-y: 10.2%;
  --chip-x: 50%;
  --chip-y: 34.1%;
  --dealer-x: 43.7%;
  --dealer-y: 26.1%;
}

.poker-table__slot--4 {
  --seat-x: 84.2%;
  --seat-y: 30.1%;
  --chip-x: 63.7%;
  --chip-y: 42%;
  --dealer-x: 67.3%;
  --dealer-y: 32.6%;
}

.poker-table__slot--5 {
  --seat-x: 84.2%;
  --seat-y: 69.9%;
  --chip-x: 63.7%;
  --chip-y: 58%;
  --dealer-x: 67.3%;
  --dealer-y: 67.4%;
}
</style>
