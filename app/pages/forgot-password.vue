<script setup lang="ts">
definePageMeta({ layout: false })

const email = ref('')
const loading = ref(false)
const sent = ref(false)
const error = ref('')

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/auth/forgot-password', { method: 'POST', body: { email: email.value } })
    sent.value = true
  } catch (err: any) {
    error.value = err?.data?.message || 'Une erreur est survenue'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthCard title="Mot de passe oublié">
    <p v-if="sent" class="banner banner-success">
      Si cet email existe, un lien de réinitialisation a été envoyé.
    </p>

    <form v-else class="form" @submit.prevent="onSubmit">
      <p v-if="error" class="banner banner-error">{{ error }}</p>
      <p class="description">Entre ton email, on t'envoie un lien pour réinitialiser ton mot de passe.</p>

      <div class="field">
        <label for="email">Email</label>
        <input id="email" v-model="email" type="email" required autocomplete="email">
      </div>

      <button type="submit" class="btn btn-primary" :disabled="loading">
        {{ loading ? 'Envoi...' : 'Envoyer le lien' }}
      </button>
    </form>

    <template #footer>
      <NuxtLink to="/login" class="link-muted center">Retour à la connexion</NuxtLink>
    </template>
  </AuthCard>
</template>

<style scoped>
.form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.description {
  color: var(--text-2);
  font-size: 0.875rem;
}

.link-muted {
  display: block;
  color: var(--text-3);
  font-size: 0.85rem;
}

.link-muted:hover { color: var(--accent-2); }
.center { text-align: center; }
</style>
