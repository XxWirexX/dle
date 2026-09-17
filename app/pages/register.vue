<script setup lang="ts">
definePageMeta({ layout: false })

const { register } = useAuth()
const router = useRouter()

const email = ref('')
const password = ref('')
const username = ref('')
const error = ref('')
const loading = ref(false)

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await register(email.value, password.value, username.value)
    await router.push('/')
  } catch (err: any) {
    error.value = err?.data?.message || 'Erreur lors de l\'inscription'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthCard title="Inscription">
    <form class="form" @submit.prevent="onSubmit">
      <p v-if="error" class="banner banner-error">{{ error }}</p>

      <div class="field">
        <label for="username">Pseudo</label>
        <input id="username" v-model="username" type="text" required autocomplete="username">
        <small>2-20 caractères, lettres, chiffres et _ uniquement</small>
      </div>

      <div class="field">
        <label for="email">Email</label>
        <input id="email" v-model="email" type="email" required autocomplete="email">
      </div>

      <div class="field">
        <label for="password">Mot de passe</label>
        <input id="password" v-model="password" type="password" required autocomplete="new-password">
        <small>Min 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre</small>
      </div>

      <button type="submit" class="btn btn-primary" :disabled="loading">
        {{ loading ? 'Inscription...' : "S'inscrire" }}
      </button>
    </form>

    <template #footer>
      <p class="footer-text">
        Déjà un compte ? <NuxtLink to="/login" class="link">Se connecter</NuxtLink>
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

.footer-text {
  text-align: center;
  color: var(--text-3);
  font-size: 0.875rem;
}

.link { color: var(--accent-2); }
.link:hover { text-decoration: underline; }
</style>
