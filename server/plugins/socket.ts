import { Server as EngineServer } from 'engine.io'
import { Server as SocketIOServer } from 'socket.io'
import { verifyToken } from '../utils/session'
import { registerMultiplayerHandlers } from '../utils/multiplayer/handlers'

/** Extrait une cookie précise d'un header `Cookie:` brut (pas besoin d'une
 *  dépendance externe pour ça, et ça évite de dépendre de la forme exacte
 *  de l'API du paquet `cookie`, qui a changé de noms d'export entre versions). */
function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return decodeURIComponent(rest.join('='))
  }
  return undefined
}

export default defineNitroPlugin((nitroApp) => {
  const engine = new EngineServer()
  const io = new SocketIOServer()
  io.bind(engine)

  // Auth par cookie httpOnly (pas de token en JS côté client) : le
  // handshake Socket.IO est une requête HTTP classique, le navigateur y
  // attache le cookie tout seul puisque c'est la même origine que l'app.
  io.use((socket, next) => {
    const token = readCookie(socket.request.headers.cookie, 'dle_token')
    socket.data.user = null
    if (token) {
      try {
        socket.data.user = verifyToken(token)
      } catch {
        socket.data.user = null
      }
    }
    next()
  })

  registerMultiplayerHandlers(io)

  nitroApp.router.use('/socket.io/', defineEventHandler({
    handler(event) {
      engine.handleRequest(event.node.req, event.node.res)
      event._handled = true
    },
    websocket: {
      open(peer) {
        const internal = (peer as any)._internal
        engine.prepare(internal.nodeReq)
        engine.onWebSocket(internal.nodeReq, internal.nodeReq.socket, peer.websocket)
      },
    },
  }))
})
