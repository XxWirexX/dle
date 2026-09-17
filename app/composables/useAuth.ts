import type { PublicUser } from '#shared/types/user'

export function useAuth() {
  const user = useState<PublicUser | null>('auth-user', () => null)
  const loading = useState<boolean>('auth-loading', () => true)

  async function fetchMe() {
    try {
      const data = await apiFetch('/api/auth/me')
      user.value = data.user
    } catch {
      user.value = null
    } finally {
      loading.value = false
    }
  }

  async function login(email: string, password: string) {
    const data = await $fetch('/api/auth/login', { method: 'POST', body: { email, password } })
    user.value = data.user
    return data.user
  }

  async function register(email: string, password: string, username: string) {
    const data = await $fetch('/api/auth/register', { method: 'POST', body: { email, password, username } })
    user.value = data.user
    return data.user
  }

  async function logout() {
    await $fetch('/api/auth/logout', { method: 'POST' })
    user.value = null
  }

  return { user, loading, fetchMe, login, register, logout }
}
