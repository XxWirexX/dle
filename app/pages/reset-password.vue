<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()
const router = useRouter()

const password = ref('')
const confirmPassword = ref('')
const error = ref('')
const loading = ref(false)
const done = ref(false)

async function onSubmit() {
  error.value = ''

  if (password.value !== confirmPassword.value) {
    error.value = 'Les mots de passe ne correspondent pas'
    return
  }

  const token = route.query.token
  if (typeof token !== 'string') {
    error.value = 'Lien invalide'
    return
  }

  loading.value = true
  try {
    await $fetch('/api/auth/reset-password', { method: 'POST', body: { token, password: password.value } })
    done.value = true
    setTimeout(() => router.push('/login'), 2000)
  } catch (err: any) {
    error.value = err?.data?.message || 'Une erreur est survenue'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthCard title="Nouveau mot de passe">
    <p v-if="done" class="banner banner-success">
      Mot de passe mis à jour, redirection vers la connexion...
    </p>

    <form v-else class="form" @submit.prevent="onSubmit">
      <p v-if="error" class="banner banner-error">{{ error }}</p>

      <div class="field">
        <label for="password">Nouveau mot de passe</label>
        <input id="password" v-model="password" type="password" required autocomplete="new-password">
        <small>Min 8 caractères, 1 majuscule, 1 minuscule, 1 chiffre</small>
      </div>

      <div class="field">
        <label for="confirm">Confirmer le mot de passe</label>
        <input id="confirm" v-model="confirmPassword" type="password" required autocomplete="new-password">
      </div>

      <button type="submit" class="btn btn-primary" :disabled="loading">
        {{ loading ? 'Envoi...' : 'Modifier le mot de passe' }}
      </button>
    </form>
  </AuthCard>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
</style>
