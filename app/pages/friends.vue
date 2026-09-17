<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { friends, incoming, outgoing, loading, refresh, sendRequest, respond, remove } = useFriends()

const usernameInput = ref('')
const sendError = ref('')
const sendSuccess = ref('')

await refresh()

async function onSend() {
  sendError.value = ''
  sendSuccess.value = ''
  try {
    await sendRequest(usernameInput.value.trim())
    sendSuccess.value = `Demande envoyée à ${usernameInput.value.trim()}`
    usernameInput.value = ''
  } catch (err: any) {
    sendError.value = err?.data?.message || 'Erreur lors de l\'envoi'
  }
}
</script>

<template>
  <div class="friends-page">
    <h1 class="title">Amis</h1>

    <div class="add-friend">
      <form class="add-form" @submit.prevent="onSend">
        <input v-model="usernameInput" placeholder="Pseudo de ton ami..." required>
        <button type="submit" class="btn btn-primary">Ajouter</button>
      </form>
      <p v-if="sendError" class="banner banner-error">{{ sendError }}</p>
      <p v-if="sendSuccess" class="banner banner-success">{{ sendSuccess }}</p>
    </div>

    <section v-if="incoming.length > 0" class="section">
      <h2 class="section-title">Demandes reçues</h2>
      <ul class="list">
        <li v-for="r in incoming" :key="r.friendshipId" class="row">
          <span class="avatar" :style="{ background: r.avatarColor }">{{ r.username[0]?.toUpperCase() }}</span>
          <span class="name">{{ r.username }}</span>
          <div class="actions">
            <button class="btn btn-primary btn-sm" @click="respond(r.friendshipId, true)">Accepter</button>
            <button class="btn btn-sm" @click="respond(r.friendshipId, false)">Refuser</button>
          </div>
        </li>
      </ul>
    </section>

    <section v-if="outgoing.length > 0" class="section">
      <h2 class="section-title">Demandes envoyées</h2>
      <ul class="list">
        <li v-for="r in outgoing" :key="r.friendshipId" class="row">
          <span class="avatar" :style="{ background: r.avatarColor }">{{ r.username[0]?.toUpperCase() }}</span>
          <span class="name">{{ r.username }}</span>
          <span class="muted">En attente...</span>
        </li>
      </ul>
    </section>

    <section class="section">
      <h2 class="section-title">Mes amis ({{ friends.length }})</h2>
      <p v-if="loading" class="muted">Chargement...</p>
      <p v-else-if="friends.length === 0" class="muted">Aucun ami pour l'instant — ajoute quelqu'un par son pseudo.</p>
      <ul v-else class="list">
        <li v-for="f in friends" :key="f.friendshipId" class="row">
          <span class="avatar" :style="{ background: f.avatarColor }">
            <span class="status-dot" :class="{ online: f.online }" />
            {{ f.username[0]?.toUpperCase() }}
          </span>
          <span class="name">{{ f.username }}</span>
          <span class="muted">{{ f.online ? 'En ligne' : 'Hors ligne' }}</span>
          <div class="actions">
            <button class="btn btn-sm" @click="remove(f.friendshipId)">Retirer</button>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.friends-page {
  max-width: 700px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.title { font-size: 1.5rem; font-weight: 800; color: var(--text); margin-bottom: 1.5rem; }

.add-friend { margin-bottom: 2rem; }

.add-form { display: flex; gap: 0.5rem; }
.add-form input {
  flex: 1;
  padding: 0.7rem 0.9rem;
  border-radius: 7px;
  border: 1px solid var(--border-2);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
  font-family: inherit;
}

.section { margin-bottom: 2rem; }
.section-title {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 0.75rem;
}

.list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }

.row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.avatar {
  position: relative;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 0.8rem;
  flex-shrink: 0;
}

.status-dot {
  position: absolute;
  bottom: -1px;
  right: -1px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #6b7280;
  border: 2px solid var(--bg);
}

.status-dot.online { background: #22c55e; }

.name { font-weight: 600; color: var(--text); flex: 1; }
.muted { color: var(--text-3); font-size: 0.82rem; }
.actions { display: flex; gap: 0.4rem; }

</style>
