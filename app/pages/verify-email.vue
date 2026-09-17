<script setup lang="ts">
definePageMeta({ layout: false })

const route = useRoute()

const status = ref<'loading' | 'success' | 'error'>('loading')
const message = ref('')

onMounted(async () => {
  const token = route.query.token
  if (typeof token !== 'string') {
    status.value = 'error'
    message.value = 'Lien invalide'
    return
  }
  try {
    const data = await $fetch('/api/auth/verify-email', { method: 'POST', body: { token } })
    status.value = 'success'
    message.value = data.message
  } catch (err: any) {
    status.value = 'error'
    message.value = err?.data?.message || 'Token invalide ou expiré'
  }
})
</script>

<template>
  <AuthCard title="Vérification email">
    <p v-if="status === 'loading'" class="banner">Vérification en cours...</p>
    <p v-else class="banner" :class="status === 'success' ? 'banner-success' : 'banner-error'">
      {{ message }}
    </p>

    <NuxtLink to="/login" class="btn btn-primary block">Retour à la connexion</NuxtLink>
  </AuthCard>
</template>

<style scoped>
.block {
  display: block;
  text-align: center;
  margin-top: 1rem;
}
</style>
