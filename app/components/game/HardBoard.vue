<script setup lang="ts">
import type { Attribute, FieldFeedback } from '#shared/types/game'

defineProps<{
  attributes: Attribute[]
  board: Record<string, FieldFeedback>
}>()
</script>

<template>
  <div class="hard-board">
    <div class="hard-board-title">Ton plateau</div>
    <div class="hard-row">
      <div v-for="attr in attributes" :key="attr.key" class="hard-slot">
        <div class="hard-slot-label">{{ attr.label }}</div>
        <GameFeedbackCell v-if="board[attr.key]" :feedback="board[attr.key]!" />
        <div v-else class="hard-slot-empty" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.hard-board {
  width: 100%;
  max-width: 60rem;
  margin: 0 auto 1.25rem;
}

.hard-board-title {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 0.6rem;
  text-align: center;
}

.hard-row {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  justify-content: center;
}

.hard-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
  min-width: 100px;
  flex: 1;
}

.hard-slot-label {
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-3);
}

.hard-slot-empty {
  width: 100%;
  min-height: 4rem;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px dashed var(--border);
}
</style>
