<script setup lang="ts">
import type { SolverBranchCell } from '#shared/utils/solver'

defineProps<{ cells: SolverBranchCell[]; compact?: boolean }>()

const arrows: Record<string, string> = { higher: '↓', lower: '↑' }
</script>

<template>
  <div class="cells-row" :class="{ compact }">
    <span v-for="c in cells" :key="c.attrKey" class="chip" :class="`bg-${c.type}`" :title="`${c.attrLabel} : ${c.type}${c.direction ? ' (' + c.direction + ')' : ''}`">
      <span v-if="!compact">{{ c.attrLabel }}</span>
      <span v-if="c.direction" class="arrow">{{ arrows[c.direction] }}</span>
    </span>
  </div>
</template>

<style scoped>
.cells-row { display: flex; flex-wrap: wrap; gap: 0.25rem; }

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  white-space: nowrap;
}

.cells-row.compact .chip {
  width: 0.85rem;
  height: 0.85rem;
  padding: 0;
  min-width: 0.85rem;
  justify-content: center;
}
.cells-row.compact .arrow { font-size: 0.6rem; }

.arrow { font-size: 0.75rem; font-weight: 800; }

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
