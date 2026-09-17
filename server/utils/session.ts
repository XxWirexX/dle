import jwt from 'jsonwebtoken'
import type { H3Event } from 'h3'
import type { AuthTokenPayload } from '#shared/types/user'

const COOKIE_NAME = 'dle_token'
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 jours

function getSecret(): string {
  const secret = useRuntimeConfig().jwtSecret
  if (!secret) {
    // Pas de valeur par défaut : contrairement à la v1, on refuse de
    // démarrer avec un secret devinable plutôt que de servir des tokens
    // falsifiables en prod si la variable d'env a été oubliée.
    throw new Error('JWT_SECRET manquant — voir .env.example')
  }
  return secret
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: TOKEN_TTL_SECONDS })
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, getSecret()) as AuthTokenPayload
}

export function setAuthCookie(event: H3Event, token: string) {
  setCookie(event, COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TOKEN_TTL_SECONDS,
    path: '/',
  })
}

export function clearAuthCookie(event: H3Event) {
  deleteCookie(event, COOKIE_NAME, { path: '/' })
}

/** Renvoie le payload du token si présent et valide, sinon `null`. Ne lève jamais. */
export function getAuthPayload(event: H3Event): AuthTokenPayload | null {
  const token = getCookie(event, COOKIE_NAME)
  if (!token) return null
  try {
    return verifyToken(token)
  } catch {
    return null
  }
}

/** Comme `getAuthPayload`, mais lève une 401 si non authentifié. */
export function requireAuthPayload(event: H3Event): AuthTokenPayload {
  const payload = getAuthPayload(event)
  if (!payload) {
    throw createError({ statusCode: 401, message: 'Non authentifié' })
  }
  return payload
}
