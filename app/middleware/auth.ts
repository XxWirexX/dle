export default defineNuxtRouteMiddleware((to) => {
  const { user, loading } = useAuth()

  if (loading.value) return // le plugin auth peuple déjà l'état avant le rendu
  if (!user.value) {
    return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
