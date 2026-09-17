import { clearAuthCookie } from '~~/server/utils/session'

export default defineEventHandler((event) => {
  clearAuthCookie(event)
  return { success: true }
})
