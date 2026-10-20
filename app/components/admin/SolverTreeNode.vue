<script setup lang="ts">
import type { SolverTreeNode } from '#shared/utils/solver'

defineProps<{ node: SolverTreeNode; depth?: number }>()
</script>

<template>
  <div class="tree-node">
    <div class="node-header">
      <strong>{{ node.guessName }}</strong>
      <span class="muted">pool={{ node.poolSize }} · E[reste]={{ node.expectedRemaining.toFixed(2) }}</span>
    </div>
    <ul class="branch-list">
      <li v-for="(b, i) in node.branches" :key="i" class="branch">
        <AdminSolverBranchCells :cells="b.cells" compact />
        <div class="branch-outcome">
          <span v-if="b.solvedCharacterName" class="outcome win">🎯 {{ b.solvedCharacterName }}</span>
          <span v-else-if="b.tiedCharacterNames" class="outcome tied">
            🎲 Indiscernables ({{ b.tiedCharacterNames.length }}) : {{ b.tiedCharacterNames.join(', ') }}
          </span>
          <details v-else-if="b.next" class="outcome-details">
            <summary>{{ b.poolSize }} candidats — voir la suite</summary>
            <AdminSolverTreeNode :node="b.next" :depth="(depth ?? 0) + 1" />
          </details>
          <span v-else class="outcome cut">… {{ b.poolSize }} candidats (profondeur max atteinte)</span>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.tree-node { font-size: 0.85rem; }

.node-header {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.4rem;
}
.muted { color: var(--text-3); font-size: 0.75rem; }

.branch-list {
  list-style: none;
  margin: 0;
  padding: 0 0 0 0.75rem;
  border-left: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.branch { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }

.branch-outcome { padding-left: 0.1rem; }

.outcome { font-size: 0.8rem; }
.outcome.win { color: #4ade80; font-weight: 600; }
.outcome.tied { color: #fbbf24; }
.outcome.cut { color: var(--text-3); font-style: italic; }

.outcome-details summary {
  cursor: pointer;
  color: var(--text-2);
  font-size: 0.8rem;
}
.outcome-details summary:hover { color: var(--text); }
.outcome-details[open] summary { margin-bottom: 0.4rem; }
</style>
