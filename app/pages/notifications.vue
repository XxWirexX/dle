<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { pendingInvites, acceptInvite, dismissInvite } = useMultiplayer()
const router = useRouter()

const sorted = computed(() => [...pendingInvites.value].sort((a, b) => b.receivedAt - a.receivedAt))

function onAccept(joinCode: string) {
  const slug = acceptInvite(joinCode)
  if (slug) router.push(`/games/${slug}/multiplayer`)
}
</script>

<template>
  <div class="notifications-page">
    <h1 class="title">Notifications</h1>

    <p v-if="sorted.length === 0" class="muted">
      Aucune invitation en attente. Les invitations à des salons multijoueur reçues de tes amis apparaîtront ici.
    </p>

    <ul v-else class="list">
      <li v-for="invite in sorted" :key="invite.joinCode" class="row">
        <div class="content">
          <p class="text">
            <strong>{{ invite.fromUsername }}</strong> t'invite à jouer sur <strong>{{ invite.gameName }}</strong>
          </p>
          <span class="muted">Code : {{ invite.joinCode }}</span>
        </div>
        <div class="actions">
          <button class="btn btn-primary btn-sm" @click="onAccept(invite.joinCode)">Rejoindre</button>
          <button class="btn btn-sm" @click="dismissInvite(invite.joinCode)">Ignorer</button>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.notifications-page {
  max-width: 700px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.title { font-size: 1.5rem; font-weight: 800; color: var(--text); margin-bottom: 1.5rem; }

.list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1.1rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.content { display: flex; flex-direction: column; gap: 0.25rem; }
.text { color: var(--text); font-size: 0.9rem; }
.muted { color: var(--text-3); font-size: 0.8rem; }
.actions { display: flex; gap: 0.4rem; flex-shrink: 0; }
</style>
