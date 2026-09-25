export interface PublicUser {
  id: number
  username: string
  email: string
  avatarColor: string
  avatarImageUrl: string | null
  emailVerified: boolean
  isAdmin: boolean
}

export interface AuthTokenPayload {
  userId: number
  username: string
}
