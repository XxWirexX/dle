export default defineNuxtPlugin(() => {
  const { user } = useAuth()
  const { connect, disconnect } = useMultiplayer()

  // Connexion persistante dès qu'on est authentifié : nécessaire pour que
  // la présence en ligne et les invitations d'amis marchent sur tout le
  // site, pas seulement sur la page multijoueur.
  watch(user, (u) => {
    if (u) connect()
    else disconnect()
  }, { immediate: true })
})
