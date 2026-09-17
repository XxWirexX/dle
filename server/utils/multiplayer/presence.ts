import type { Server } from 'socket.io'

export type PresenceStatus = 'online' | 'in-game'

interface UserPresence {
  socketIds: Set<string>
  status: PresenceStatus
}

/**
 * Registre de présence en mémoire (mono-process, cohérent avec le choix
 * de ne pas introduire Redis tant qu'il n'y a qu'une seule instance de
 * l'app). Un utilisateur peut avoir plusieurs sockets (plusieurs onglets) :
 * on ne le considère hors-ligne que quand le dernier se déconnecte.
 */
class PresenceService {
  private users = new Map<number, UserPresence>()
  private io: Server | null = null

  bind(io: Server) {
    this.io = io
  }

  connect(userId: number, socketId: string) {
    const existing = this.users.get(userId)
    if (existing) {
      existing.socketIds.add(socketId)
      return
    }
    this.users.set(userId, { socketIds: new Set([socketId]), status: 'online' })
  }

  /** Renvoie `true` si c'était sa dernière connexion active (vraiment hors-ligne). */
  disconnect(userId: number, socketId: string): boolean {
    const entry = this.users.get(userId)
    if (!entry) return true
    entry.socketIds.delete(socketId)
    if (entry.socketIds.size === 0) {
      this.users.delete(userId)
      return true
    }
    return false
  }

  setStatus(userId: number, status: PresenceStatus) {
    const entry = this.users.get(userId)
    if (entry) entry.status = status
  }

  isOnline(userId: number): boolean {
    return this.users.has(userId)
  }

  statusOf(userId: number): PresenceStatus | 'offline' {
    return this.users.get(userId)?.status ?? 'offline'
  }

  socketIdsOf(userId: number): string[] {
    return [...(this.users.get(userId)?.socketIds ?? [])]
  }

  /** Émet un événement vers toutes les sockets actives d'un utilisateur (no-op si hors-ligne). */
  notifyUser(userId: number, event: string, payload: unknown) {
    if (!this.io) return
    for (const socketId of this.socketIdsOf(userId)) {
      this.io.to(socketId).emit(event, payload)
    }
  }
}

export const presence = new PresenceService()
