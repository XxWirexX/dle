<script setup lang="ts">
import type { FieldFeedback } from '#shared/types/game'

defineProps<{ feedback: FieldFeedback }>()

const arrows: Record<string, string> = { higher: '↓', lower: '↑' }
</script>

<template>
  <div class="cell" :class="`bg-${feedback.type}`">
    <span class="text">{{ feedback.label }}</span>
    <span v-if="feedback.type === 'higher' || feedback.type === 'lower'" class="arrow">
      {{ feedback.type === 'higher' ? '↓' : '↑' }}
    </span>
    <span v-else-if="feedback.direction" class="arrow subtle">{{ arrows[feedback.direction] }}</span>
  </div>
</template>

<style scoped>
.cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border-radius: 10px;
  padding: 0.5rem;
  min-height: 4rem;
  min-width: 100px;
  flex: 1;
  text-align: center;
}

.text {
  color: #fff;
  font-weight: 700;
  font-size: 0.8rem;
  line-height: 1.2;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
  word-break: break-word;
}

.arrow {
  font-size: 0.9rem;
  font-weight: 800;
  color: #fff;
}

.arrow.subtle { opacity: 0.85; font-size: 0.7rem; }

.bg-correct {
  background: linear-gradient(145deg, #15803d 0%, #166534 100%);
  border: 1px solid rgba(74, 222, 128, 0.28);
}

.bg-close {
  background: linear-gradient(145deg, #a16207 0%, #854d0e 100%);
  border: 1px solid rgba(251, 191, 36, 0.32);
}

.bg-higher, .bg-lower, .bg-wrong {
  background: linear-gradient(145deg, #b91c1c 0%, #991b1b 100%);
  border: 1px solid rgba(239, 68, 68, 0.22);
}
</style>
