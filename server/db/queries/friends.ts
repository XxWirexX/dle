import { eq, and, or } from 'drizzle-orm'
import { db } from '../client'
import { friendships, users } from '../schema'

export async function findFriendship(userA: number, userB: number) {
  return db.query.friendships.findFirst({
    where: or(
      and(eq(friendships.requesterId, userA), eq(friendships.addresseeId, userB)),
      and(eq(friendships.requesterId, userB), eq(friendships.addresseeId, userA)),
    ),
  })
}

export async function sendFriendRequest(requesterId: number, addresseeId: number) {
  const existing = await findFriendship(requesterId, addresseeId)
  if (existing) return existing

  const [row] = await db.insert(friendships).values({ requesterId, addresseeId, status: 'pending' }).returning()
  return row!
}

export async function respondToRequest(friendshipId: number, addresseeId: number, accept: boolean) {
  if (!accept) {
    await db.delete(friendships).where(and(eq(friendships.id, friendshipId), eq(friendships.addresseeId, addresseeId)))
    return null
  }
  const [row] = await db.update(friendships)
    .set({ status: 'accepted', respondedAt: new Date() })
    .where(and(eq(friendships.id, friendshipId), eq(friendships.addresseeId, addresseeId)))
    .returning()
  return row ?? null
}

export async function removeFriendship(userId: number, friendshipId: number) {
  await db.delete(friendships).where(and(
    eq(friendships.id, friendshipId),
    or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
  ))
}

export interface FriendRow {
  friendshipId: number
  userId: number
  username: string
  avatarColor: string
  avatarImageUrl: string | null
}

export async function listAcceptedFriends(userId: number): Promise<FriendRow[]> {
  const rows = await db.query.friendships.findMany({
    where: and(
      eq(friendships.status, 'accepted'),
      or(eq(friendships.requesterId, userId), eq(friendships.addresseeId, userId)),
    ),
    with: {
      requester: { columns: { id: true, username: true, avatarColor: true, avatarImageUrl: true } },
      addressee: { columns: { id: true, username: true, avatarColor: true, avatarImageUrl: true } },
    },
  })

  return rows.map((r) => {
    const other = r.requesterId === userId ? r.addressee : r.requester
    return {
      friendshipId: r.id,
      userId: other.id,
      username: other.username,
      avatarColor: other.avatarColor,
      avatarImageUrl: other.avatarImageUrl,
    }
  })
}

export interface RequestRow {
  friendshipId: number
  userId: number
  username: string
  avatarColor: string
  createdAt: Date
}

export async function listIncomingRequests(userId: number): Promise<RequestRow[]> {
  const rows = await db.query.friendships.findMany({
    where: and(eq(friendships.status, 'pending'), eq(friendships.addresseeId, userId)),
    with: { requester: { columns: { id: true, username: true, avatarColor: true } } },
  })
  return rows.map((r) => ({
    friendshipId: r.id,
    userId: r.requester.id,
    username: r.requester.username,
    avatarColor: r.requester.avatarColor,
    createdAt: r.createdAt,
  }))
}

export async function listOutgoingRequests(userId: number): Promise<RequestRow[]> {
  const rows = await db.query.friendships.findMany({
    where: and(eq(friendships.status, 'pending'), eq(friendships.requesterId, userId)),
    with: { addressee: { columns: { id: true, username: true, avatarColor: true } } },
  })
  return rows.map((r) => ({
    friendshipId: r.id,
    userId: r.addressee.id,
    username: r.addressee.username,
    avatarColor: r.addressee.avatarColor,
    createdAt: r.createdAt,
  }))
}

export function findUserByUsernameForFriends(username: string) {
  return db.query.users.findFirst({
    where: eq(users.username, username),
    columns: { id: true, username: true },
  })
}
