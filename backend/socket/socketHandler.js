const GameManager = require('./gameManager');
const { verifyToken } = require('../auth/authUtils');
const { updateStats } = require('../db/database');

function setupSocketHandlers(io) {
  const gameManager = new GameManager();

  // Middleware pour authentifier les connexions Socket.IO
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (token) {
      try {
        socket.user = verifyToken(token);
      } catch (err) {
        socket.user = null;
      }
    } else {
      socket.user = null;
    }
    next();
  });

  io.on('connection', (socket) => {
    const username = socket.user?.username || `Joueur`;
    console.log(`Player connected: ${socket.id} (${username})`);

    // Rejoindre la queue de matchmaking
    socket.on('join-queue', ({ animeId, gameData }) => {
      console.log(`${socket.id} joining queue for anime: ${animeId}`);

      const result = gameManager.joinQueue(socket, animeId, gameData, socket.user);

      if (result.status === 'queue-joined') {
        socket.emit('queue-joined', { position: result.position });
      } else if (result.status === 'already-in-queue') {
        socket.emit('queue-joined', { position: result.position });
      } else if (result.status === 'match-found') {
        const { roomId, room, players } = result;

        // Faire rejoindre les deux joueurs dans la room Socket.IO
        players.forEach((playerSocket, index) => {
          playerSocket.join(roomId);
          const isFirstTurn = room.currentTurn === playerSocket.id;
          const opponentId = players.find(p => p.id !== playerSocket.id)?.id;

          playerSocket.emit('match-found', {
            roomId,
            isYourTurn: isFirstTurn,
            opponentId,
            gameData: room.gameData,
            maxAttempts: room.gameData.maxAttempts || 26
          });
        });

        console.log(`Match created: ${roomId}`);
      }
    });

    // Quitter la queue
    socket.on('leave-queue', ({ animeId }) => {
      gameManager.leaveQueue(socket, animeId);
      socket.emit('queue-left');
      console.log(`${socket.id} left queue for anime: ${animeId}`);
    });

    // Faire un guess
    socket.on('make-guess', ({ roomId, character }) => {
      const result = gameManager.makeGuess(socket, roomId, character);

      if (result.error) {
        socket.emit('guess-error', { error: result.error });
        return;
      }

      const room = gameManager.getPlayerRoom(socket.id);
      const opponentId = gameManager.getOpponentId(room, socket.id);

      if (result.status === 'game-over') {
        // Envoyer le résultat au joueur qui a deviné
        socket.emit('guess-result', {
          attempt: result.attempt,
          isCorrect: true
        });

        // Annoncer la fin de partie aux deux joueurs
        io.to(roomId).emit('game-over', {
          winner: result.winner,
          target: result.target,
          winnerId: socket.id
        });

        // Enregistrer les stats des joueurs connectés
        const playerIds = Object.keys(room.players);
        playerIds.forEach(playerId => {
          const player = room.players[playerId];
          if (player.user && player.user.userId) {
            const won = playerId === socket.id;
            updateStats(player.user.userId, room.animeId, won);
          }
        });

        console.log(`Game over in ${roomId}, winner: ${socket.id}`);
      } else {
        // Envoyer le résultat au joueur
        socket.emit('guess-result', {
          attempt: result.attempt,
          isCorrect: false,
          isYourTurn: false
        });

        // Informer l'adversaire
        const opponentSocket = io.sockets.sockets.get(opponentId);
        if (opponentSocket) {
          opponentSocket.emit('opponent-guess', {
            attempt: result.attempt,
            isYourTurn: true
          });
        }
      }
    });

    // Demander une revanche
    socket.on('request-rematch', () => {
      const room = gameManager.getPlayerRoom(socket.id);
      if (!room) {
        socket.emit('rematch-error', { error: 'Room introuvable' });
        return;
      }

      const result = gameManager.requestRematch(socket);

      if (result.error) {
        socket.emit('rematch-error', { error: result.error });
        return;
      }

      const opponentId = gameManager.getOpponentId(room, socket.id);

      if (result.status === 'rematch-starting') {
        // Notifier les deux joueurs du nouveau match
        const playerIds = Object.keys(room.players);
        playerIds.forEach(playerId => {
          const playerSocket = io.sockets.sockets.get(playerId);
          if (playerSocket) {
            playerSocket.emit('rematch-starting', {
              isYourTurn: result.room.currentTurn === playerId
            });
          }
        });
        console.log(`Rematch starting in room ${room.id}`);
      } else {
        // Notifier l'adversaire de la demande de revanche
        const opponentSocket = io.sockets.sockets.get(opponentId);
        if (opponentSocket) {
          opponentSocket.emit('rematch-requested');
        }
        socket.emit('rematch-vote-registered');
      }
    });

    // Quitter la room
    socket.on('leave-room', () => {
      const result = gameManager.leaveRoom(socket);
      if (result && result.opponentId) {
        const opponentSocket = io.sockets.sockets.get(result.opponentId);
        if (opponentSocket) {
          opponentSocket.emit('opponent-left');
        }
      }
      socket.emit('room-left');
    });

    // Déconnexion
    socket.on('disconnect', () => {
      console.log(`Player disconnected: ${socket.id}`);
      const result = gameManager.handleDisconnect(socket);

      if (result && result.opponentId) {
        const opponentSocket = io.sockets.sockets.get(result.opponentId);
        if (opponentSocket) {
          opponentSocket.emit('opponent-disconnected');
        }
      }
    });
  });

  return gameManager;
}

module.exports = setupSocketHandlers;
