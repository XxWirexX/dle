<script setup lang="ts">
definePageMeta({ layout: false })

const { user } = useAuth()

type Phase = 'init' | 'error'
const phase = ref<Phase>('init')
const errorMessage = ref('')

onMounted(async () => {
  const config = useRuntimeConfig()
  if (!config.public.discordClientId) {
    phase.value = 'error'
    errorMessage.value = "L'Activity Discord n'est pas configurée côté serveur."
    return
  }

  try {
    const { DiscordSDK } = await import('@discord/embedded-app-sdk')
    const discordSdk = new DiscordSDK(config.public.discordClientId)
    await discordSdk.ready()

    const { code } = await discordSdk.commands.authorize({
      client_id: config.public.discordClientId,
      response_type: 'code',
      state: '',
      prompt: 'none',
      scope: ['identify'],
    })

    const { access_token } = await $fetch<{ access_token: string }>('/api/discord/token', {
      method: 'POST',
      body: { code },
    })

    await discordSdk.commands.authenticate({ access_token })

    const { user: me } = await $fetch<{ user: typeof user.value }>('/api/discord/activity-login', {
      method: 'POST',
      body: { access_token },
    })
    user.value = me

    await navigateTo('/')
  } catch (err: any) {
    phase.value = 'error'
    errorMessage.value = err?.data?.message || err?.message || 'Erreur de connexion à Discord'
  }
})
</script>

<template>
  <div class="activity-page">
    <div v-if="phase === 'init'" class="panel center">
      <p class="muted">Connexion à Discord...</p>
    </div>
    <div v-else class="panel center">
      <h1 class="title">Oups</h1>
      <p class="subtitle">{{ errorMessage }}</p>
    </div>
  </div>
</template>

<style scoped>
.activity-page {
  min-height: 100vh;
  background: var(--bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.panel.center {
  max-width: 28rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
}

.title { font-size: 1.5rem; font-weight: 800; color: var(--text); }
.subtitle { color: var(--text-2); }
.muted { color: var(--text-3); font-size: 0.9rem; }
</style>
