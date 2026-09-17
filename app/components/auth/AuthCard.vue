<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <div class="auth-container">
    <NuxtLink to="/" class="auth-brand">
      <span class="auth-brand-mark">D</span>
      <span class="auth-brand-name">DLE</span>
    </NuxtLink>

    <div class="auth-card">
      <h1 class="auth-title">{{ title }}</h1>
      <slot />
    </div>

    <div v-if="$slots.footer" class="auth-footer">
      <slot name="footer" />
    </div>
  </div>
</template>

<style scoped>
.auth-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(ellipse at 15% 40%, rgba(59, 130, 246, 0.09) 0%, transparent 55%),
    radial-gradient(ellipse at 85% 15%, rgba(139, 92, 246, 0.07) 0%, transparent 45%),
    radial-gradient(ellipse at 55% 88%, rgba(16, 185, 129, 0.05) 0%, transparent 40%),
    var(--bg);
  padding: 1.5rem;
  gap: 1.5rem;
}

.auth-brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.5rem;
}

.auth-brand-mark {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: linear-gradient(135deg, var(--accent), #8b5cf6);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.85rem;
}

.auth-brand-name {
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--accent);
  letter-spacing: -0.01em;
}

.auth-card {
  background: var(--bg-card);
  border: 1px solid var(--border-2);
  border-radius: var(--radius);
  padding: 2rem;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 0 0 1px var(--border), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  position: relative;
  overflow: hidden;
}

.auth-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
}

.auth-title {
  text-align: center;
  color: var(--text);
  margin-bottom: 1.5rem;
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.auth-footer {
  width: 100%;
  max-width: 400px;
}
</style>
