<script setup lang="ts">
const { user, logout } = useAuth()
const { pendingInvites, dismissInvite, acceptInvite } = useMultiplayer()
const router = useRouter()

const userMenuOpen = ref(false)

async function onLogout() {
  userMenuOpen.value = false
  await logout()
  await router.push('/')
}

function onAcceptInvite(joinCode: string) {
  const slug = acceptInvite(joinCode)
  if (slug) router.push(`/games/${slug}/multiplayer`)
}

// Un seul toast affiché à la fois (le plus récent) pour ne pas empiler les
// popups — les autres invitations restent visibles sur /notifications.
const latestInvite = computed(() => pendingInvites.value[pendingInvites.value.length - 1] ?? null)
</script>

<template>
  <div class="layout">
    <header class="navbar">
      <NuxtLink to="/" class="brand">
        <span class="brand-mark">D</span>
        <span class="brand-name">DLE</span>
      </NuxtLink>

      <nav class="nav-links">
        <NuxtLink v-if="user" to="/games/create" class="nav-link">Créer un DLE</NuxtLink>
        <NuxtLink v-if="user" to="/notifications" class="nav-link notif-link">
          Notifications
          <span v-if="pendingInvites.length" class="notif-badge">{{ pendingInvites.length }}</span>
        </NuxtLink>
        <NuxtLink v-if="user?.isAdmin" to="/admin" class="nav-link">Admin</NuxtLink>
      </nav>

      <div class="user-area">
        <template v-if="user">
          <div class="user-menu" @click="userMenuOpen = !userMenuOpen">
            <span class="avatar" :style="{ background: user.avatarColor }">
              <img v-if="user.avatarImageUrl" :src="cloudinaryUrl(user.avatarImageUrl, 64)" :alt="user.username">
              <span v-else>{{ user.username[0]?.toUpperCase() }}</span>
            </span>
            <span v-if="pendingInvites.length" class="avatar-badge" />
            <span class="username">{{ user.username }}</span>
          </div>

          <div v-if="userMenuOpen" class="dropdown" @click="userMenuOpen = false">
            <NuxtLink to="/profile" class="dropdown-item">Mon profil</NuxtLink>
            <NuxtLink to="/friends" class="dropdown-item">Amis</NuxtLink>
            <NuxtLink to="/games/create" class="dropdown-item mobile-only">Créer un DLE</NuxtLink>
            <NuxtLink to="/notifications" class="dropdown-item mobile-only">
              Notifications
              <span v-if="pendingInvites.length" class="notif-badge">{{ pendingInvites.length }}</span>
            </NuxtLink>
            <NuxtLink v-if="user?.isAdmin" to="/admin" class="dropdown-item mobile-only">Admin</NuxtLink>
            <button class="dropdown-item danger" @click="onLogout">Se déconnecter</button>
          </div>
        </template>
        <NuxtLink v-else to="/login" class="btn btn-primary btn-sm">Connexion</NuxtLink>
      </div>
    </header>

    <main>
      <slot />
    </main>

    <footer class="site-footer">
      <NuxtLink to="/conditions">Conditions d'utilisation</NuxtLink>
      <span class="footer-sep">·</span>
      <NuxtLink to="/confidentialite">Politique de confidentialité</NuxtLink>
    </footer>

    <div v-if="latestInvite" class="invite-toast">
      <p><strong>{{ latestInvite.fromUsername }}</strong> t'invite à jouer sur <strong>{{ latestInvite.gameName }}</strong></p>
      <div class="invite-actions">
        <button class="btn btn-primary btn-sm" @click="onAcceptInvite(latestInvite.joinCode)">Rejoindre</button>
        <button class="btn btn-sm" @click="dismissInvite(latestInvite.joinCode)">Ignorer</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout {
  min-height: 100vh;
  background: var(--bg);
}

.navbar {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 0 1.5rem;
  height: 52px;
  background: rgba(13, 13, 20, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border);
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.brand-mark {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: linear-gradient(135deg, var(--accent), #8b5cf6);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.8rem;
}

.brand-name {
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--accent);
  letter-spacing: 0.02em;
}

.nav-links {
  display: flex;
  gap: 0.15rem;
}

.nav-link {
  padding: 0.35rem 0.85rem;
  color: var(--text-2);
  font-weight: 500;
  font-size: 0.875rem;
  border-radius: 5px;
  transition: background 0.15s, color 0.15s;
}

.nav-link:hover {
  background: rgba(255, 255, 255, 0.07);
  color: var(--text);
}

.nav-link.router-link-exact-active {
  color: var(--text);
  font-weight: 600;
}

.notif-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.notif-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 0.65rem;
  font-weight: 800;
}

.user-area {
  margin-left: auto;
  position: relative;
  flex-shrink: 0;
}

.user-menu {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 8px;
  transition: background 0.15s;
  position: relative;
}

.avatar-badge {
  position: absolute;
  top: 0;
  left: 20px;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid rgba(13, 13, 20, 0.95);
}

.user-menu:hover {
  background: rgba(255, 255, 255, 0.06);
}

.avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 0.75rem;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.username {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
}

.dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 160px;
  background: rgba(10, 10, 20, 0.98);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border-2);
  border-radius: 10px;
  padding: 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
}

.dropdown-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.5rem 0.6rem;
  border-radius: 6px;
  border: none;
  background: none;
  color: var(--text-2);
  font-size: 0.85rem;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.dropdown-item:hover {
  background: rgba(255, 255, 255, 0.07);
  color: var(--text);
}

.dropdown-item.danger:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
}

.invite-toast {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
  max-width: 320px;
  padding: 1rem 1.2rem;
  background: rgba(10, 10, 20, 0.98);
  backdrop-filter: blur(20px);
  border: 1px solid var(--border-2);
  border-radius: 14px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  color: var(--text);
  font-size: 0.875rem;
}

.invite-toast p { margin-bottom: 0.75rem; }
.invite-actions { display: flex; gap: 0.5rem; }

.site-footer {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.6rem;
  padding: 1.5rem;
  color: var(--text-3);
  font-size: 0.78rem;
}

.site-footer a { color: var(--text-3); }
.site-footer a:hover { color: var(--text-2); }
.footer-sep { opacity: 0.5; }

/* En dessous de ce seuil, "Jeux/Créer un DLE/Notifications/Admin" en
   ligne dans la navbar pousse le menu utilisateur (et donc la
   déconnexion) hors de l'écran — on les replie dans le menu déroulant
   de l'avatar, qui reste toujours accessible. */
.mobile-only { display: none; }

@media (max-width: 640px) {
  .navbar { gap: 0.75rem; padding: 0 0.85rem; }
  .nav-links { display: none; }
  .username { display: none; }
  .mobile-only { display: block; }
}

@media (max-width: 420px) {
  .brand-name { display: none; }
}

@media (max-width: 480px) {
  .invite-toast { left: 12px; right: 12px; bottom: 12px; max-width: none; }
}
</style>
