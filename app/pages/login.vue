<script setup lang="ts">
definePageMeta({ layout: false })

const { login } = useAuth()
const route = useRoute()
const router = useRouter()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await login(email.value, password.value)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.push(redirect)
  } catch (err: any) {
    error.value = err?.data?.message || 'Erreur de connexion'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthCard title="Connexion">
    <form class="form" @submit.prevent="onSubmit">
      <p v-if="error" class="banner banner-error">{{ error }}</p>

      <div class="field">
        <label for="email">Email</label>
        <input id="email" v-model="email" type="email" required autocomplete="email">
      </div>

      <div class="field">
        <label for="password">Mot de passe</label>
        <input id="password" v-model="password" type="password" required autocomplete="current-password">
      </div>

      <button type="submit" class="btn btn-primary" :disabled="loading">
        {{ loading ? 'Connexion...' : 'Se connecter' }}
      </button>

      <NuxtLink to="/forgot-password" class="link-muted center">Mot de passe oublié ?</NuxtLink>
    </form>

    <template #footer>
      <p class="footer-text">
        Pas encore de compte ? <NuxtLink to="/register" class="link">S'inscrire</NuxtLink>
      </p>
    </template>
  </AuthCard>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.link-muted {
  color: var(--text-3);
  font-size: 0.82rem;
}

.link-muted:hover { color: var(--accent-2); }

.center { text-align: center; }

.footer-text {
  text-align: center;
  color: var(--text-3);
  font-size: 0.875rem;
}

.link { color: var(--accent-2); }
.link:hover { text-decoration: underline; }
</style>
