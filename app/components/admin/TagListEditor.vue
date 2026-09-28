<script setup lang="ts">
const props = defineProps<{
  modelValue: string[]
  placeholder?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

const draft = ref('')

function commit() {
  const value = draft.value.trim()
  draft.value = ''
  if (!value) return
  if (props.modelValue.some((v) => v.toLowerCase() === value.toLowerCase())) return
  emit('update:modelValue', [...props.modelValue, value])
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ',') {
    e.preventDefault()
    commit()
  } else if (e.key === 'Backspace' && !draft.value && props.modelValue.length) {
    emit('update:modelValue', props.modelValue.slice(0, -1))
  }
}

function removeAt(i: number) {
  emit('update:modelValue', props.modelValue.filter((_, idx) => idx !== i))
}
</script>

<template>
  <div class="tag-editor">
    <span v-for="(tag, i) in modelValue" :key="tag" class="tag-chip">
      {{ tag }}
      <button type="button" class="tag-remove" title="Retirer" @click="removeAt(i)">✕</button>
    </span>
    <input
      v-model="draft"
      type="text"
      :placeholder="modelValue.length ? 'Ajouter...' : placeholder"
      class="tag-input"
      @keydown="onKeydown"
      @blur="commit"
    >
  </div>
</template>

<style scoped>
.tag-editor {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
  padding: 0.4rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--border-2);
  background: rgba(255, 255, 255, 0.04);
  min-height: 2.3rem;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text);
  font-size: 0.78rem;
  white-space: nowrap;
}

.tag-remove {
  background: none;
  border: none;
  color: var(--text-3);
  cursor: pointer;
  font-size: 0.68rem;
  line-height: 1;
  padding: 0;
}
.tag-remove:hover { color: #f87171; }

.tag-input {
  flex: 1;
  min-width: 100px;
  border: none;
  background: transparent;
  color: var(--text);
  font-family: inherit;
  font-size: 0.85rem;
  outline: none;
  padding: 0.15rem 0;
}
</style>
