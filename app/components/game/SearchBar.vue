<script setup lang="ts">
import type { Character } from '#shared/types/game'

const props = defineProps<{
  characters: Character[]
  excludeIds: number[]
  disabled?: boolean
  placeholder?: string
}>()

const emit = defineEmits<{ select: [character: Character] }>()

const query = ref('')
const showSuggestions = ref(false)
const containerRef = useTemplateRef('containerRef')

const suggestions = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return []
  const excluded = new Set(props.excludeIds)
  return props.characters
    .filter((c) => !excluded.has(c.id) && c.name.toLowerCase().includes(q))
    .slice(0, 8)
})

function pick(character: Character) {
  emit('select', character)
  query.value = ''
  // Après une sélection au clavier (Entrée), le champ reste focus — pas de
  // nouvel événement `focus` pour repasser showSuggestions à true, donc
  // retaper juste après ne remontrait plus jamais de suggestions tant que
  // l'utilisateur ne recliquait pas dans le champ. On le laisse "armé" :
  // rien ne s'affiche tant que la requête est vide (suggestions.length
  // === 0), et la liste réapparaît dès qu'un nouveau texte matche.
  showSuggestions.value = true
}

function pickFirst() {
  if (suggestions.value.length > 0) pick(suggestions.value[0]!)
}

onClickOutside(containerRef, () => { showSuggestions.value = false })
</script>

<template>
  <div ref="containerRef" class="search-container">
    <input
      v-model="query"
      type="text"
      class="search-input"
      :placeholder="placeholder ?? 'Rechercher un personnage...'"
      :disabled="disabled"
      @focus="showSuggestions = true"
      @keydown.enter.prevent="pickFirst"
    >

    <div v-if="showSuggestions && suggestions.length > 0" class="suggestions">
      <button v-for="c in suggestions" :key="c.id" class="suggestion" @click="pick(c)">
        <div class="suggestion-image"><SafeImage :src="c.imageUrl" :alt="c.name" :width="60" /></div>
        <span class="suggestion-name">{{ c.name }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.search-container {
  max-width: 52rem;
  margin: 0 auto;
  position: relative;
}

.search-input {
  width: 100%;
  padding: 0.9rem 1.2rem;
  background: rgba(8, 8, 16, 0.72);
  backdrop-filter: blur(16px);
  border: 1px solid var(--border-2);
  color: #fff;
  font-size: 0.95rem;
  border-radius: 10px;
  outline: none;
  font-family: inherit;
  transition: border-color 0.2s;
}

.search-input:focus { border-color: rgba(59, 130, 246, 0.55); }
.search-input::placeholder { color: rgba(255, 255, 255, 0.25); }
.search-input:disabled { opacity: 0.4; cursor: not-allowed; }

.suggestions {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 6px);
  background: rgba(8, 8, 18, 0.97);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border);
  border-radius: 10px;
  overflow: hidden;
  z-index: 50;
  max-height: 24rem;
  overflow-y: auto;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
}

.suggestion {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.65rem 1rem;
  background: none;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
}

.suggestion:last-child { border-bottom: none; }
.suggestion:hover { background: rgba(59, 130, 246, 0.1); }

.suggestion-image {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.05);
}

.suggestion-name { color: rgba(255, 255, 255, 0.88); font-weight: 600; font-size: 0.9rem; }
</style>
