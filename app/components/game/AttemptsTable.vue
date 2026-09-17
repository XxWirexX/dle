<script setup lang="ts">
import type { Attribute, Character, GuessFeedback } from '#shared/types/game'

defineProps<{
  attributes: Attribute[]
  attempts: { character: Character; feedback: GuessFeedback }[]
}>()
</script>

<template>
  <div class="wrapper">
    <div class="table">
      <div class="headers">
        <div class="header-cell image">Perso</div>
        <div v-for="attr in attributes" :key="attr.key" class="header-cell">{{ attr.label }}</div>
      </div>

      <TransitionGroup name="row" tag="div" class="rows">
        <div v-for="attempt in attempts" :key="attempt.character.id" class="row">
          <div class="cell image">
            <div class="portrait"><SafeImage :src="attempt.character.imageUrl" :alt="attempt.character.name" :width="100" /></div>
            <span class="name">{{ attempt.character.name }}</span>
          </div>
          <GameFeedbackCell v-for="attr in attributes" :key="attr.key" :feedback="attempt.feedback[attr.key]!" />
        </div>
      </TransitionGroup>
    </div>
  </div>
</template>

<style scoped>
.wrapper {
  width: 100%;
  overflow-x: auto;
  padding-bottom: 1rem;
  -webkit-overflow-scrolling: touch;
}

.table {
  min-width: max-content;
  margin: 0 auto;
}

.headers, .row {
  display: flex;
  gap: 0.6rem;
}

.headers { margin-bottom: 0.75rem; }

.rows {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.header-cell {
  min-width: 100px;
  flex: 1;
  text-align: center;
  color: var(--text-3);
  font-weight: 700;
  font-size: 0.6rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.header-cell.image { min-width: 90px; flex: 0 0 90px; }

.cell.image {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  min-width: 90px;
  flex: 0 0 90px;
}

.portrait {
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid var(--border-2);
  background: rgba(255, 255, 255, 0.05);
}

.name {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-2);
  text-align: center;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-enter-active { transition: all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
.row-enter-from { opacity: 0; transform: translateY(-10px) scale(0.97); }

@media (max-width: 768px) {
  .header-cell { min-width: 70px; font-size: 0.55rem; }
  .header-cell.image { min-width: 70px; flex-basis: 70px; }
  .cell.image { min-width: 70px; flex-basis: 70px; }
  .portrait { width: 3.2rem; height: 3.2rem; }
}
</style>
