<script setup lang="ts">
const props = defineProps<{
  src: string
  alt: string
  width?: number
}>()

const errored = ref(false)
const optimizedSrc = computed(() => cloudinaryUrl(props.src, props.width))

watch(() => props.src, () => { errored.value = false })
</script>

<template>
  <div v-if="errored || !src" class="fallback" :title="alt">
    {{ alt?.[0]?.toUpperCase() || '?' }}
  </div>
  <img v-else :src="optimizedSrc" :alt="alt" loading="lazy" @error="errored = true">
</template>

<style scoped>
.fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-3);
  font-weight: 700;
}

img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
</style>
