import { eq, sql } from 'drizzle-orm'
import crypto from 'node:crypto'
import { db } from '../client'
import { users } from '../schema'
import type { PublicUser } from '#shared/types/user'

const AVATAR_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e',
]

function randomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)]!
}

function randomToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export function toPublicUser(row: typeof users.$inferSelect): PublicUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    avatarColor: row.avatarColor,
    avatarImageUrl: row.avatarImageUrl,
    emailVerified: row.emailVerified,
    isAdmin: row.isAdmin,
  }
}

export async function createUser(email: string, passwordHash: string, username: string) {
  const verificationToken = randomToken()
  const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)

  const [row] = await db.insert(users).values({
    email,
    passwordHash,
    username,
    avatarColor: randomAvatarColor(),
    verificationToken,
    verificationTokenExpires,
  }).returning()

  return { row: row!, verificationToken }
}

export function findUserByEmail(email: string) {
  return db.query.users.findFirst({ where: eq(users.email, email) })
}

export function findUserByUsername(username: string) {
  return db.query.users.findFirst({ where: sql`lower(${users.username}) = lower(${username})` })
}

export function findUserById(id: number) {
  return db.query.users.findFirst({ where: eq(users.id, id) })
}

export function findUserByVerificationToken(token: string) {
  return db.query.users.findFirst({ where: eq(users.verificationToken, token) })
}

export function verifyUserEmail(userId: number) {
  return db.update(users)
    .set({ emailVerified: true, verificationToken: null, verificationTokenExpires: null })
    .where(eq(users.id, userId))
}

export async function createPasswordResetToken(userId: number) {
  const token = randomToken()
  const expires = new Date(Date.now() + 60 * 60 * 1000)
  await db.update(users)
    .set({ passwordResetToken: token, passwordResetExpires: expires })
    .where(eq(users.id, userId))
  return token
}

export function findUserByResetToken(token: string) {
  return db.query.users.findFirst({ where: eq(users.passwordResetToken, token) })
}

export function updateUserPassword(userId: number, passwordHash: string) {
  return db.update(users)
    .set({ passwordHash, passwordResetToken: null, passwordResetExpires: null })
    .where(eq(users.id, userId))
}

export async function resendVerificationToken(userId: number) {
  const verificationToken = randomToken()
  const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)
  await db.update(users)
    .set({ verificationToken, verificationTokenExpires })
    .where(eq(users.id, userId))
  return verificationToken
}

export function updateUserAvatar(userId: number, avatarImageUrl: string | null) {
  return db.update(users).set({ avatarImageUrl }).where(eq(users.id, userId))
}
