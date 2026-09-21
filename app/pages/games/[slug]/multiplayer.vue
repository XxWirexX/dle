<script setup lang="ts">
import type { RoomMode } from '#shared/types/multiplayer'

definePageMeta({ layout: false })

const route = useRoute()
const slug = route.params.slug as string
const { user } = useAuth()

const { data: game, error: gameError } = await useFetch(`/api/games/${slug}/play`, { key: `game-play-${slug}` })
if (gameError.value || !game.value) {
  throw createError({ statusCode: 404, statusMessage: 'Jeu introuvable' })
}

const {
  room, inQueue, error, messages, mySocketId,
  quickMatch, leaveQueue, createRoom, joinRoom, startRoom, guess, rematch, sendChat, leaveRoom, inviteFriend,
} = useMultiplayer()

const { friends, refresh: refreshFriends } = useFriends()
if (user.value) await refreshFriends()
const onlineFriends = computed(() => friends.value.filter((f) => f.online))
const invitedFriendIds = ref<number[]>([])

// Dans la salle d'attente, on ne propose que les amis en ligne qui ne sont
// pas déjà dans le salon (pas d'intérêt à réinviter quelqu'un présent).
const invitableFriends = computed(() => {
  if (!room.value) return onlineFriends.value
  const inRoom = new Set(room.value.players.map((p) => p.userId))
  return onlineFriends.value.filter((f) => !inRoom.has(f.userId))
})

function onInviteFriend(friendUserId: number) {
  inviteFriend(friendUserId, slug, 8)
  invitedFriendIds.value = [...invitedFriendIds.value, friendUserId]
}

const joinCodeInput = ref(typeof route.query.code === 'string' ? route.query.code : '')
const createMaxPlayers = ref(2)
const createMode = ref<RoomMode>('classic')
const showCreatePanel = ref(false)

const isHost = computed(() => !!room.value && room.value.hostSocketId === mySocketId.value)
// En mode "hard" l'exclusion est propre à chaque joueur (myGuessedIds),
// puisqu'il n'y a pas de feed partagé pour la dériver comme en classique.
const guessedIds = computed(() => {
  if (!room.value) return []
  return room.value.mode === 'hard' ? (room.value.myGuessedIds ?? []) : room.value.attempts.map((a) => a.character.id)
})
const isMyTurn = computed(() => !!room.value && room.value.currentTurnSocketId === mySocketId.value)
const iWon = computed(() => !!room.value && room.value.winnerSocketId === mySocketId.value)
const winnerName = computed(() => room.value?.players.find((p) => p.socketId === room.value?.winnerSocketId)?.username)

function onGuess(character: { id: number }) {
  guess(character.id)
}

function copyJoinLink() {
  if (!room.value?.joinCode) return
  const url = `${location.origin}/games/${slug}/multiplayer?code=${room.value.joinCode}`
  navigator.clipboard?.writeText(url)
}

onBeforeUnmount(() => {
  if (room.value) leaveRoom()
})
</script>

<template>
  <div v-if="game" class="game" :style="{ backgroundImage: `url(${cloudinaryUrl(game.backgroundUrl, 1600)})` }">
    <div class="overlay">
      <div class="nav">
        <NuxtLink :to="`/games/${slug}`" class="back">← {{ game.name }}</NuxtLink>
      </div>

      <div v-if="!user" class="panel center">
        <p>Tu dois être connecté pour jouer en multijoueur.</p>
        <NuxtLink :to="`/login?redirect=${encodeURIComponent(route.fullPath)}`" class="btn btn-primary">Se connecter</NuxtLink>
      </div>

      <!-- ─── Lobby : pas encore de room ─── -->
      <div v-else-if="!room" class="lobby">
        <h1 class="title">Multijoueur — {{ game.name }}</h1>
        <p v-if="error" class="banner banner-error">{{ error }}</p>

        <div v-if="inQueue" class="panel center">
          <div class="spinner" />
          <p>Recherche d'un adversaire...</p>
          <button class="btn" @click="leaveQueue(slug)">Annuler</button>
        </div>

        <div v-else class="lobby-options">
          <div class="option-card">
            <h3>Partie rapide</h3>
            <p>Affronte un adversaire au hasard, 1 contre 1.</p>
            <button class="btn btn-primary" @click="quickMatch(slug)">Chercher une partie</button>
          </div>

          <div class="option-card">
            <h3>Créer un salon</h3>
            <p>Jusqu'à 8 joueurs, tu partages un code d'invitation.</p>
            <div v-if="showCreatePanel" class="create-form">
              <label>Nombre de joueurs max
                <input v-model.number="createMaxPlayers" type="number" min="2" max="8">
              </label>
              <label>Mode
                <select v-model="createMode">
                  <option value="classic">Classique — feed partagé des tentatives</option>
                  <option value="hard">Difficile — chacun son plateau, pas de feed</option>
                </select>
              </label>
              <button class="btn btn-primary" @click="createRoom(slug, createMaxPlayers, null, createMode)">Créer</button>
            </div>
            <button v-else class="btn" @click="showCreatePanel = true">Créer un salon</button>
          </div>

          <div class="option-card">
            <h3>Rejoindre un salon</h3>
            <p>Entre le code que ton ami t'a partagé.</p>
            <div class="create-form">
              <input v-model="joinCodeInput" placeholder="CODE" maxlength="6" style="text-transform: uppercase">
              <button class="btn btn-primary" :disabled="!joinCodeInput" @click="joinRoom(joinCodeInput)">Rejoindre</button>
            </div>
          </div>

          <div v-if="invitableFriends.length > 0" class="option-card">
            <h3>Inviter un ami</h3>
            <p>{{ invitableFriends.length }} ami{{ invitableFriends.length > 1 ? 's' : '' }} en ligne</p>
            <ul class="friend-invite-list">
              <li v-for="f in invitableFriends" :key="f.userId">
                <span>{{ f.username }}</span>
                <button
                  class="btn btn-sm"
                  :disabled="invitedFriendIds.includes(f.userId)"
                  @click="onInviteFriend(f.userId)"
                >
                  {{ invitedFriendIds.includes(f.userId) ? 'Invité' : 'Inviter' }}
                </button>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- ─── Salle d'attente ─── -->
      <div v-else-if="room.status === 'waiting'" class="panel center">
        <h2 class="title">Salle d'attente</h2>
        <div v-if="room.joinCode" class="join-code">
          <span>Code : <strong>{{ room.joinCode }}</strong></span>
          <button class="btn" @click="copyJoinLink">Copier le lien</button>
        </div>
        <ul class="player-list">
          <li v-for="p in room.players" :key="p.socketId">{{ p.username }} <span v-if="p.socketId === room.hostSocketId">(hôte)</span></li>
        </ul>
        <p class="muted">{{ room.players.length }} / {{ room.maxPlayers }} joueurs</p>

        <div v-if="invitableFriends.length > 0 && room.players.length < room.maxPlayers" class="option-card invite-in-room">
          <h3>Inviter un ami</h3>
          <ul class="friend-invite-list">
            <li v-for="f in invitableFriends" :key="f.userId">
              <span>{{ f.username }}</span>
              <button
                class="btn btn-sm"
                :disabled="invitedFriendIds.includes(f.userId)"
                @click="onInviteFriend(f.userId)"
              >
                {{ invitedFriendIds.includes(f.userId) ? 'Invité' : 'Inviter' }}
              </button>
            </li>
          </ul>
        </div>

        <button v-if="isHost" class="btn btn-primary" :disabled="room.players.length < 2" @click="startRoom">
          Démarrer la partie
        </button>
        <p v-else class="muted">En attente que l'hôte démarre la partie...</p>
        <button class="btn btn-danger" @click="leaveRoom">Quitter</button>
      </div>

      <!-- ─── Partie en cours / terminée ─── -->
      <div v-else class="playing">
        <div class="mode-badge" :class="{ hard: room.mode === 'hard' }">
          Multijoueur{{ room.mode === 'hard' ? ' — Difficile' : '' }}
        </div>
        <h1 class="title">{{ game.name }}</h1>

        <div class="scoreboard">
          <span
            v-for="p in room.players"
            :key="p.socketId"
            class="player-chip"
            :class="{ me: p.socketId === mySocketId, disconnected: !p.connected }"
          >
            {{ p.username }} — {{ p.score }}
          </span>
        </div>

        <div v-if="room.status === 'playing'" class="turn-indicator" :class="{ mine: isMyTurn }">
          {{ isMyTurn ? "C'est ton tour !" : 'Au tour de ' + (room.players.find(p => p.socketId === room.currentTurnSocketId)?.username ?? '...') }}
        </div>

        <GameSearchBar
          v-if="room.status === 'playing'"
          :characters="game.characters"
          :exclude-ids="guessedIds"
          :disabled="!isMyTurn"
          @select="onGuess"
        />

        <div v-if="room.status === 'finished'" class="game-over">
          <div class="result" :class="iWon ? 'win' : 'lose'">{{ iWon ? 'Tu as gagné !' : `${winnerName} a gagné` }}</div>
          <div class="actions">
            <button v-if="isHost" class="btn btn-primary" @click="rematch">Revanche</button>
            <p v-else class="muted">En attente de l'hôte pour la revanche...</p>
            <button class="btn btn-danger" @click="leaveRoom">Quitter</button>
          </div>
        </div>

        <template v-if="room.mode === 'hard'">
          <div v-if="room.myLastGuess" class="hard-last-guess">
            <div class="hard-last-guess-title">Ta dernière tentative</div>
            <div class="hard-last-guess-row">
              <div class="portrait">
                <SafeImage :src="room.myLastGuess.character.imageUrl" :alt="room.myLastGuess.character.name" :width="60" />
              </div>
              <span class="hard-last-guess-name">{{ room.myLastGuess.character.name }}</span>
              <GameFeedbackCell v-for="attr in room.attributes" :key="attr.key" :feedback="room.myLastGuess.feedback[attr.key]!" />
            </div>
          </div>
          <GameHardBoard :attributes="room.attributes" :board="room.myBoard ?? {}" />
        </template>

        <GameSharedAttemptsFeed
          v-else-if="room.attempts.length > 0"
          :attributes="room.attributes"
          :attempts="room.attempts"
          :my-socket-id="mySocketId"
        />
      </div>

      <GameChatBox v-if="room" :messages="messages" :my-socket-id="mySocketId" @send="sendChat" />
    </div>
  </div>
</template>

<style scoped>
.game { min-height: 100vh; background-size: cover; background-position: center; background-attachment: fixed; }
.overlay { min-height: 100vh; background: linear-gradient(180deg, rgba(5, 5, 12, 0.68) 0%, rgba(5, 5, 12, 0.88) 60%, rgba(5, 5, 12, 0.96) 100%); padding: 1.5rem; }

.nav { max-width: 1400px; margin: 0 auto 1rem; }
.back { color: var(--text-2); font-weight: 500; font-size: 0.875rem; padding: 0.4rem 0.8rem; border-radius: 6px; }
.back:hover { background: rgba(255, 255, 255, 0.07); }

.title { text-align: center; font-size: 1.75rem; font-weight: 800; color: #fff; margin-bottom: 1.5rem; text-shadow: 0 2px 24px rgba(0, 0, 0, 0.7); }

.center { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; text-align: center; }

.panel {
  max-width: 30rem;
  margin: 3rem auto;
  padding: 2rem;
  background: rgba(8, 8, 18, 0.85);
  border: 1px solid var(--border-2);
  border-radius: 18px;
}

.spinner {
  width: 40px; height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.lobby-options {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
  max-width: 900px;
  margin: 0 auto;
}

.option-card {
  padding: 1.5rem;
  background: rgba(8, 8, 18, 0.7);
  border: 1px solid var(--border);
  border-radius: 16px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
}

.option-card h3 { color: #fff; font-size: 1.05rem; }
.option-card p { color: var(--text-2); font-size: 0.85rem; }

.create-form { display: flex; flex-direction: column; gap: 0.5rem; width: 100%; }
.create-form input,
.create-form select {
  padding: 0.6rem 0.8rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-2);
  border-radius: 8px;
  color: #fff;
  text-align: center;
  font-family: inherit;
  width: 100%;
}

.join-code { display: flex; align-items: center; gap: 0.75rem; color: var(--text-2); }
.join-code strong { color: var(--accent-2); font-size: 1.2rem; letter-spacing: 0.1em; }

.friend-invite-list {
  list-style: none;
  padding: 0;
  margin: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.friend-invite-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  color: var(--text-2);
  font-size: 0.85rem;
}

.player-list { list-style: none; padding: 0; margin: 0; color: #fff; }
.player-list li { padding: 0.3rem 0; }

.invite-in-room { width: 100%; margin: 1rem 0; }

.muted { color: var(--text-3); font-size: 0.85rem; }

.btn-danger { background: rgba(185, 28, 28, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); color: rgba(252, 165, 165, 0.9); }
.btn-danger:hover:not(:disabled) { background: rgba(185, 28, 28, 0.22); color: #fff; }

.mode-badge {
  display: block;
  width: fit-content;
  margin: 0 auto 0.5rem;
  padding: 0.3rem 1rem;
  background: linear-gradient(135deg, #7c3aed, #6d28d9);
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #fff;
  text-transform: uppercase;
}

.mode-badge.hard { background: linear-gradient(135deg, #b91c1c, #991b1b); }

.hard-last-guess {
  max-width: 60rem;
  margin: 0 auto 1rem;
}

.hard-last-guess-title {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 0.5rem;
  text-align: center;
}

.hard-last-guess-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border);
  border-radius: 10px;
  flex-wrap: wrap;
  justify-content: center;
}

.hard-last-guess-row .portrait {
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
}

.hard-last-guess-name { font-weight: 700; color: #fff; font-size: 0.85rem; margin-right: 0.3rem; }

.scoreboard {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.player-chip {
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border);
  color: var(--text-2);
  font-size: 0.82rem;
  font-weight: 600;
}

.player-chip.me { background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.3); color: #6ee7b7; }
.player-chip.disconnected { opacity: 0.4; text-decoration: line-through; }

.turn-indicator {
  text-align: center;
  padding: 0.6rem;
  margin-bottom: 1rem;
  border-radius: 30px;
  max-width: 20rem;
  margin-left: auto;
  margin-right: auto;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-2);
  font-weight: 600;
  font-size: 0.875rem;
}

.turn-indicator.mine { background: linear-gradient(135deg, #059669, #047857); color: #fff; }

.game-over {
  max-width: 26rem;
  margin: 1.5rem auto;
  padding: 1.5rem;
  background: rgba(8, 8, 18, 0.9);
  border: 1px solid var(--border-2);
  border-radius: 16px;
  text-align: center;
}

.result { font-size: 1.5rem; font-weight: 800; margin-bottom: 1rem; }
.result.win { color: #4ade80; }
.result.lose { color: #f87171; }

.actions { display: flex; flex-direction: column; gap: 0.5rem; align-items: center; }

@media (max-width: 768px) {
  .overlay { padding: 1rem; }
  .title { font-size: 1.4rem; }
}
</style>
